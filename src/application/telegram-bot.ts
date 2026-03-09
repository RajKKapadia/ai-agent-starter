import { InputGuardrailTripwireTriggered } from '@openai/agents';
import { v4 as uuidv4 } from 'uuid';

import { AppContext } from '../agent/context';
import { PendingApprovalState, TelegramCallbackQuery, TelegramMessage, TelegramUpdate } from '../types';
import type { PendingApprovalStore } from '../persistence/approval-state.store';
import type { ToolApprovalAuditRepository } from '../persistence/tool-approval.repository';
import type { TelegramGateway } from '../services/telegram';
import type { AgentExecutionResult, AgentRunner } from './agent-runner';

const PENDING_APPROVAL_TTL_SECONDS = 600;

export class TelegramBotApplication {
    constructor(
        private readonly telegramGateway: TelegramGateway,
        private readonly agentRunner: AgentRunner,
        private readonly pendingApprovalStore: PendingApprovalStore<PendingApprovalState>,
        private readonly toolApprovalAuditRepository: ToolApprovalAuditRepository,
    ) {}

    async handleUpdate(update: TelegramUpdate): Promise<void> {
        if (update.callback_query) {
            await this.handleCallbackQuery(update.callback_query);
            return;
        }

        if (update.message?.text) {
            await this.handleMessage(update.message);
        }
    }

    private async handleMessage(message: TelegramMessage): Promise<void> {
        const chatId = message.chat.id;
        const context = this.buildContext(message);

        try {
            await this.telegramGateway.sendTypingAction(chatId);
            const result = await this.agentRunner.runText(message.text!.trim(), context);
            await this.respondToAgentResult(chatId, context, result);
        } catch (error) {
            if (error instanceof InputGuardrailTripwireTriggered) {
                await this.telegramGateway.sendMessage(chatId, 'I can not help with this query.');
                return;
            }

            console.error('Error handling Telegram message:', error);
            await this.telegramGateway.sendMessage(chatId, 'We are facing a technical issue.');
        }
    }

    private async handleCallbackQuery(callbackQuery: TelegramCallbackQuery): Promise<void> {
        const chatId = callbackQuery.message?.chat.id;
        const messageId = callbackQuery.message?.message_id;
        const callbackData = callbackQuery.data;

        if (!chatId || !messageId || !callbackData) {
            return;
        }

        const [decision, approvalId] = callbackData.split(':');
        if (!approvalId || (decision !== 'approve' && decision !== 'reject')) {
            await this.telegramGateway.answerCallbackQuery({
                callback_query_id: callbackQuery.id,
                text: 'Invalid approval response.',
                show_alert: true,
            });
            return;
        }

        await this.telegramGateway.answerCallbackQuery({
            callback_query_id: callbackQuery.id,
            text: decision === 'approve' ? 'Approval recorded' : 'Rejection recorded',
        });

        const storeKey = this.buildApprovalStoreKey(chatId, approvalId);
        const pendingState = await this.pendingApprovalStore.get(storeKey);
        if (!pendingState) {
            await this.telegramGateway.editMessageText(chatId, messageId, 'This approval request has expired. Send the command again.');
            return;
        }

        await this.telegramGateway.editMessageText(
            chatId,
            messageId,
            [
                decision === 'approve' ? 'Approved' : 'Rejected',
                '',
                `Tool: ${pendingState.toolName}`,
                `Arguments: ${JSON.stringify(pendingState.toolArguments, null, 2)}`,
            ].join('\n'),
        );

        await this.pendingApprovalStore.delete(storeKey);
        await this.toolApprovalAuditRepository.record({
            userId: pendingState.userContext.userId,
            toolName: pendingState.toolName,
            toolArguments: pendingState.toolArguments,
            approved: decision === 'approve',
        });

        try {
            await this.telegramGateway.sendTypingAction(chatId);
            const result = await this.agentRunner.resumePendingRun(pendingState.serializedState, pendingState.userContext, decision);
            await this.respondToAgentResult(chatId, pendingState.userContext, result);
        } catch (error) {
            console.error('Error resuming approval flow:', error);
            await this.telegramGateway.sendMessage(chatId, 'We are facing a technical issue.');
        }
    }

    private async respondToAgentResult(chatId: number, context: AppContext, result: AgentExecutionResult): Promise<void> {
        if (result.pendingApproval && result.serializedState) {
            const approvalId = uuidv4();
            const storeKey = this.buildApprovalStoreKey(chatId, approvalId);
            const pendingState: PendingApprovalState = {
                serializedState: result.serializedState,
                userContext: context,
                chatId,
                timestamp: Date.now(),
                toolName: result.pendingApproval.toolName,
                toolArguments: result.pendingApproval.toolArguments,
            };

            await this.pendingApprovalStore.save(storeKey, pendingState, PENDING_APPROVAL_TTL_SECONDS);
            const sentMessage = await this.telegramGateway.sendMessage(
                chatId,
                [
                    'Approval required',
                    '',
                    `Tool: ${result.pendingApproval.toolName}`,
                    `Arguments: ${JSON.stringify(result.pendingApproval.toolArguments, null, 2)}`,
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
                },
            );

            pendingState.messageId = sentMessage.message_id;
            await this.pendingApprovalStore.save(storeKey, pendingState, PENDING_APPROVAL_TTL_SECONDS);
            return;
        }

        await this.telegramGateway.sendMessage(chatId, result.finalOutput ?? 'Done.');
    }

    private buildContext(message: TelegramMessage): AppContext {
        return {
            userId: String(message.from?.id ?? message.chat.id),
            userName: [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || 'Unknown',
            channel: 'telegram',
            telegramChatId: String(message.chat.id),
            telegramUserId: String(message.from?.id ?? message.chat.id),
            locale: message.from?.language_code,
        };
    }

    private buildApprovalStoreKey(chatId: number, approvalId: string): string {
        return `pending:telegram:${chatId}:${approvalId}`;
    }
}
