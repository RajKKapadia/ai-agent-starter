import { appConfig } from '../env';

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${appConfig.TELEGRAM_BOT_TOKEN}`;

export interface TelegramMessage {
    message_id: number;
    from?: {
        id: number;
        first_name: string;
        last_name?: string;
        username?: string;
    };
    chat: {
        id: number;
        type: string;
        first_name?: string;
        username?: string;
    };
    text?: string;
    date: number;
}

export interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
}

export interface SendMessageOptions {
    parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML';
    reply_to_message_id?: number;
}

/**
 * Send a text message to a Telegram chat
 */
export async function sendMessage(
    chatId: number,
    text: string,
    options: SendMessageOptions = {}
): Promise<void> {
    const response = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            ...options,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Telegram sendMessage failed: ${JSON.stringify(error)}`);
    }
}

/**
 * Send a typing action indicator to a chat
 */
export async function sendTypingAction(chatId: number): Promise<void> {
    await fetch(`${TELEGRAM_API_BASE}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    });
}

/**
 * Handle interruptions by sending approval request with inline keyboard
 * @param result - Agent run result containing interruptions
 * @param chatId - Telegram chat ID
 * @param userContext - User context
 * @param startIndex - Index of interruption to handle (for sequential processing)
 */
async function handleInterruptions(
    result: any,
    chatId: number,
    userContext: any,
    startIndex: number = 0
): Promise<void> {
    // Generate unique approval ID
    const approvalId = uuidv4();

    // Get current interruption and calculate total
    const interruption = result.interruptions[startIndex];
    const toolName = interruption.name;
    const toolArgs = JSON.stringify(interruption.arguments);
    const totalInterruptions = result.interruptions.length;

    // Store pending state in Redis
    const pendingState: TelegramPendingState = {
        serializedState: JSON.stringify(result.state),
        userContext: userContext,
        interruptions: result.interruptions,
        chatId: chatId,
        timestamp: Date.now(),
        toolName: toolName,
        toolArguments: interruption.arguments,
        currentInterruptionIndex: startIndex,
    };

    const redisKey = `pending:telegram:${chatId}:${approvalId}`;
    await storePendingState(redisKey, JSON.stringify(pendingState), 600); // 10 minutes TTL

    // Build approval message with progress counter
    let approvalText = `🔔 Approval Required`;
    if (totalInterruptions > 1) {
        approvalText += ` (${startIndex + 1} of ${totalInterruptions})`;
    }
    approvalText += `\n\n`;
    approvalText += `I would like to execute: ${toolName}\n`;
    approvalText += `Arguments: ${toolArgs}\n\n`;
    approvalText += `Do you approve this action?`;

    // Send message with inline keyboard
    const sentMessage = await sendTelegramMessage({
        chat_id: chatId,
        text: approvalText,
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [[
                { text: '✅ Approve', callback_data: `approve:${approvalId}` },
                { text: '❌ Reject', callback_data: `reject:${approvalId}` },
            ]],
        },
    });

    // Update stored state with message ID for later editing
    pendingState.messageId = sentMessage.result.message_id;
    await storePendingState(redisKey, JSON.stringify(pendingState), 600);
}

/**
 * Handle callback query (button click)
 */
export async function handleCallbackQuery(callbackQuery: TelegramCallbackQuery): Promise<void> {
    const chatId = callbackQuery.message?.chat.id;
    const messageId = callbackQuery.message?.message_id;
    const callbackData = callbackQuery.data;

    if (!chatId || !callbackData) {
        return;
    }

    try {
        // Parse callback data: "approve:approvalId" or "reject:approvalId"
        const [action, approvalId] = callbackData.split(':');

        if (!action || !approvalId || !['approve', 'reject'].includes(action)) {
            throw new Error('Invalid callback data');
        }

        // Answer callback query immediately (removes loading state)
        await answerCallbackQuery({
            callback_query_id: callbackQuery.id,
            text: action === 'approve' ? 'Approved!' : 'Rejected!',
        });

        // Retrieve pending state from Redis
        const redisKey = `pending:telegram:${chatId}:${approvalId}`;
        const pendingStateStr = await getPendingState(redisKey);

        if (!pendingStateStr) {
            // State expired or not found
            await editTelegramMessage({
                chat_id: chatId,
                message_id: messageId,
                text: '⏰ This approval request has expired. Please try your request again.',
                parse_mode: 'HTML',
            });
            return;
        }

        const pendingState: TelegramPendingState = JSON.parse(pendingStateStr);

        // Deserialize run state
        const state = await RunState.fromString(caloryTrackingAgent, pendingState.serializedState);

        // Apply approval or rejection for CURRENT interruption only
        const currentInterruption = pendingState.interruptions[pendingState.currentInterruptionIndex];
        if (action === 'approve') {
            state.approve(currentInterruption);
        } else {
            state.reject(currentInterruption);
        }

        // Check if there are more interruptions to handle
        const nextIndex = pendingState.currentInterruptionIndex + 1;
        const hasMoreInterruptions = nextIndex < pendingState.interruptions.length;

        // Edit the approval message to show decision
        const actionEmoji = action === 'approve' ? '✅' : '❌';
        const actionText = action === 'approve' ? 'Approved' : 'Rejected';
        await editTelegramMessage({
            chat_id: chatId,
            message_id: messageId,
            text: `${actionEmoji} ${actionText}\n\nTool: ${pendingState.toolName}\nArguments: ${JSON.stringify(pendingState.toolArguments)}`,
            parse_mode: 'HTML',
        });

        if (hasMoreInterruptions) {
            // Don't resume yet, show next interruption
            const nextResult = {
                state: state,
                interruptions: pendingState.interruptions,
            };

            // Show next interruption
            await handleInterruptions(nextResult, chatId, pendingState.userContext, nextIndex);

            // Clean up current Redis state
            await deletePendingState(redisKey);
        } else {
            // All interruptions handled, resume agent execution
            // Show typing indicator while agent processes
            await sendChatAction({
                chat_id: chatId,
                action: 'typing',
            });

            const session = new CustomSession({ userId: pendingState.userContext.userId });

            const resumeResult = await run(caloryTrackingAgent, state, {
                context: pendingState.userContext,
                stream: false,
                session: session,
            });

            // Check for more interruptions from agent (new ones, not sequential)
            if (resumeResult.interruptions && resumeResult.interruptions.length > 0) {
                await handleInterruptions(resumeResult, chatId, pendingState.userContext);
            } else {
                // Send final result
                await sendTelegramMessage({
                    chat_id: chatId,
                    text: String(resumeResult.finalOutput || 'Done!'),
                    parse_mode: 'HTML',
                });
            }

            // Clean up Redis state
            await deletePendingState(redisKey);
        }
    } catch (error) {
        console.error('Error handling callback query:', error);
        await answerCallbackQuery({
            callback_query_id: callbackQuery.id,
            text: 'Error processing your response',
            show_alert: true,
        });
    }
}
