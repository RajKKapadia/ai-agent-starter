import { UserContext } from './agent/context';

/**
 * Telegram Update types
 * Based on Telegram Bot API documentation
 */

export interface TelegramUser {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
}

export interface TelegramChat {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
}

export interface TelegramPhotoSize {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    file_size?: number;
}

export interface TelegramFile {
    file_id: string;
    file_unique_id: string;
    file_size?: number;
    file_path?: string;
}

export interface TelegramMessage {
    message_id: number;
    from?: TelegramUser;
    date: number;
    chat: TelegramChat;
    text?: string;
    caption?: string;
    photo?: TelegramPhotoSize[];
    entities?: Array<{
        type: string;
        offset: number;
        length: number;
    }>;
    document?: { file_id: string };
    video?: { file_id: string };
    voice?: { file_id: string };
    audio?: { file_id: string };
    sticker?: { file_id: string };
    animation?: { file_id: string };
    video_note?: { file_id: string };
    contact?: { phone_number: string };
    location?: { latitude: number; longitude: number };
    venue?: { location: unknown };
    poll?: { id: string };
    dice?: { emoji: string };
}

export interface TelegramCallbackQuery {
    id: string;
    from: TelegramUser;
    message?: TelegramMessage;
    data?: string;
    chat_instance: string;
}

export interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
    callback_query?: TelegramCallbackQuery;
}

/**
 * Pending approval state stored in Redis
 */
export interface TelegramPendingState {
    serializedState: string;
    userContext: UserContext;
    chatId: number;
    messageId?: number;
    timestamp: number;
    toolName: string;
    toolArguments: unknown;
}

/**
 * Callback data structure for inline buttons
 * Format: action:approvalId
 */
export interface TelegramApprovalCallback {
    action: 'approve' | 'reject';
    approvalId: string;
}

/**
 * Response structure for Telegram API sendMessage
 */
export interface TelegramSendMessageRequest {
    chat_id: number | string;
    text: string;
    parse_mode?: 'Markdown' | 'HTML' | 'MarkdownV2';
    reply_markup?: TelegramInlineKeyboardMarkup;
    reply_to_message_id?: number;
}

/**
 * Inline keyboard markup for buttons
 */
export interface TelegramInlineKeyboardMarkup {
    inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface TelegramInlineKeyboardButton {
    text: string;
    callback_data?: string;
    url?: string;
}

/**
 * Response structure for answering callback queries
 */
export interface TelegramAnswerCallbackQueryRequest {
    callback_query_id: string;
    text?: string;
    show_alert?: boolean;
}
