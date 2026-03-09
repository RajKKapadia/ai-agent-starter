import { RunResult, RunState, run } from '@openai/agents';
import { v4 as uuidv4 } from 'uuid';

import { weatherAgent } from '../agent';
import { UserContext } from '../agent/context';
import { CustomSession } from '../agent/session';
import { appConfig } from '../env';
import {
    TelegramAnswerCallbackQueryRequest,
    TelegramCallbackQuery,
    TelegramPendingState,
    TelegramSendMessageRequest,
} from '../types';
import { deletePendingState, getPendingState, storePendingState } from './redis';

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${appConfig.TELEGRAM_BOT_TOKEN}`;
const PENDING_APPROVAL_TTL_SECONDS = 600;

type TelegramApiResponse<T> = {
    ok: boolean;
    result: T;
    description?: string;
};

type TelegramSendMessageResult = {
    message_id: number;
};

type TelegramEditMessageRequest = TelegramSendMessageRequest & {
    message_id: number;
};

type WeatherRunResult = RunResult<any, any>;

export interface SendMessageOptions {
    parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML';
    reply_to_message_id?: number;
    reply_markup?: TelegramSendMessageRequest['reply_markup'];
}

async function telegramRequest<TResponse>(method: string, payload: unknown): Promise<TResponse> {
    const response = await fetch(`${TELEGRAM_API_BASE}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    const data = await response.json() as TelegramApiResponse<TResponse>;
    if (!response.ok || !data.ok) {
        throw new Error(`Telegram ${method} failed: ${JSON.stringify(data)}`);
    }

    return data.result;
}

export async function sendMessage(
    chatId: number,
    text: string,
    options: SendMessageOptions = {}
): Promise<TelegramSendMessageResult> {
    return telegramRequest<TelegramSendMessageResult>('sendMessage', {
        chat_id: chatId,
        text,
        ...options,
    });
}

export async function sendTypingAction(chatId: number): Promise<void> {
    await telegramRequest('sendChatAction', {
        chat_id: chatId,
        action: 'typing',
    });
}

async function editTelegramMessage(payload: TelegramEditMessageRequest): Promise<void> {
    await telegramRequest('editMessageText', payload);
}

async function answerCallbackQuery(payload: TelegramAnswerCallbackQueryRequest): Promise<void> {
    await telegramRequest('answerCallbackQuery', payload);
}

function buildPendingStateKey(chatId: number, approvalId: string): string {
    return `pending:telegram:${chatId}:${approvalId}`;
}

function formatToolArgs(toolArguments: unknown): string {
    return JSON.stringify(toolArguments, null, 2);
}

export async function handleInterruptions(
    result: WeatherRunResult,
    chatId: number,
    userContext: UserContext
): Promise<void> {
    const interruption = result.interruptions[0];
    if (!interruption) {
        return;
    }

    const approvalId = uuidv4();
    const toolName = interruption.name ?? 'unknown_tool';
    const toolArguments = interruption.arguments;
    const pendingState: TelegramPendingState = {
        serializedState: result.state.toString(),
        userContext,
        chatId,
        timestamp: Date.now(),
        toolName,
        toolArguments,
    };

    const redisKey = buildPendingStateKey(chatId, approvalId);
    await storePendingState(redisKey, JSON.stringify(pendingState), PENDING_APPROVAL_TTL_SECONDS);

    const sentMessage = await sendMessage(
        chatId,
        [
            'Approval required',
            '',
            `Tool: ${toolName}`,
            `Arguments: ${formatToolArgs(toolArguments)}`,
            '',
            'Do you approve this action?',
        ].join('\n'),
        {
            reply_markup: {
                inline_keyboard: [[
                    { text: 'Approve', callback_data: `approve:${approvalId}` },
                    { text: 'Reject', callback_data: `reject:${approvalId}` },
                ]],
            },
        }
    );

    pendingState.messageId = sentMessage.message_id;
    await storePendingState(redisKey, JSON.stringify(pendingState), PENDING_APPROVAL_TTL_SECONDS);
}

export async function handleCallbackQuery(callbackQuery: TelegramCallbackQuery): Promise<void> {
    const chatId = callbackQuery.message?.chat.id;
    const messageId = callbackQuery.message?.message_id;
    const callbackData = callbackQuery.data;

    if (!chatId || !messageId || !callbackData) {
        return;
    }

    try {
        const [action, approvalId] = callbackData.split(':');
        if (!approvalId || (action !== 'approve' && action !== 'reject')) {
            throw new Error('Invalid callback data');
        }

        await answerCallbackQuery({
            callback_query_id: callbackQuery.id,
            text: action === 'approve' ? 'Approval recorded' : 'Rejection recorded',
        });

        const redisKey = buildPendingStateKey(chatId, approvalId);
        const pendingStateStr = await getPendingState(redisKey);

        if (!pendingStateStr) {
            await editTelegramMessage({
                chat_id: chatId,
                message_id: messageId,
                text: 'This approval request has expired. Send the command again.',
            });
            return;
        }

        const pendingState = JSON.parse(pendingStateStr) as TelegramPendingState;
        const state = await RunState.fromString(weatherAgent, pendingState.serializedState);

        const interruption = state.getInterruptions()[0];
        if (!interruption) {
            await editTelegramMessage({
                chat_id: chatId,
                message_id: messageId,
                text: 'This approval request is no longer pending.',
            });
            await deletePendingState(redisKey);
            return;
        }

        if (action === 'approve') {
            state.approve(interruption);
        } else {
            state.reject(interruption, {
                message: 'The Telegram user rejected this tool call.',
            });
        }

        await editTelegramMessage({
            chat_id: chatId,
            message_id: messageId,
            text: [
                action === 'approve' ? 'Approved' : 'Rejected',
                '',
                `Tool: ${pendingState.toolName}`,
                `Arguments: ${formatToolArgs(pendingState.toolArguments)}`,
            ].join('\n'),
        });

        await deletePendingState(redisKey);
        await sendTypingAction(chatId);

        const resumeResult = await run(weatherAgent, state as RunState<UserContext, typeof weatherAgent>, {
            context: pendingState.userContext,
            stream: false,
            session: new CustomSession({ userId: pendingState.userContext.userId }),
        });

        if (resumeResult.interruptions.length > 0) {
            await handleInterruptions(resumeResult as WeatherRunResult, chatId, pendingState.userContext);
            return;
        }

        await sendMessage(chatId, String(resumeResult.finalOutput ?? 'Done.'));
    } catch (error) {
        console.error('Error handling callback query:', error);
        await answerCallbackQuery({
            callback_query_id: callbackQuery.id,
            text: 'Failed to process approval',
            show_alert: true,
        });
    }
}
