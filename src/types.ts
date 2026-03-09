import { AppContext } from './agent/context';

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

export interface TelegramMessage {
    message_id: number;
    from?: TelegramUser;
    date: number;
    chat: TelegramChat;
    text?: string;
    caption?: string;
    photo?: TelegramPhotoSize[];
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

export interface PendingApprovalState {
    serializedState: string;
    userContext: AppContext;
    chatId: number;
    messageId?: number;
    timestamp: number;
    toolName: string;
    toolArguments: unknown;
}

export interface TelegramSendMessageRequest {
    chat_id: number | string;
    text: string;
    parse_mode?: 'Markdown' | 'HTML' | 'MarkdownV2';
    reply_markup?: TelegramInlineKeyboardMarkup;
    reply_to_message_id?: number;
}

export interface TelegramInlineKeyboardMarkup {
    inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface TelegramInlineKeyboardButton {
    text: string;
    callback_data?: string;
    url?: string;
}

export interface TelegramAnswerCallbackQueryRequest {
    callback_query_id: string;
    text?: string;
    show_alert?: boolean;
}
