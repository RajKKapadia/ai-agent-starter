import {
    TelegramAnswerCallbackQueryRequest,
    TelegramInlineKeyboardMarkup,
    TelegramSendMessageRequest,
} from '../types';

export interface TelegramMessageResult {
    message_id: number;
}

export interface TelegramGateway {
    sendMessage(chatId: number, text: string, options?: SendMessageOptions): Promise<TelegramMessageResult>;
    sendTypingAction(chatId: number): Promise<void>;
    editMessageText(chatId: number, messageId: number, text: string): Promise<void>;
    answerCallbackQuery(payload: TelegramAnswerCallbackQueryRequest): Promise<void>;
}

export interface SendMessageOptions {
    parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML';
    reply_to_message_id?: number;
    reply_markup?: TelegramInlineKeyboardMarkup;
}

type TelegramApiResponse<T> = {
    ok: boolean;
    result: T;
    description?: string;
};

export class TelegramBotClient implements TelegramGateway {
    private readonly apiBase: string;

    constructor(botToken: string) {
        this.apiBase = `https://api.telegram.org/bot${botToken}`;
    }

    async sendMessage(chatId: number, text: string, options: SendMessageOptions = {}): Promise<TelegramMessageResult> {
        return this.request<TelegramMessageResult>('sendMessage', {
            chat_id: chatId,
            text,
            ...options,
        } satisfies TelegramSendMessageRequest);
    }

    async sendTypingAction(chatId: number): Promise<void> {
        await this.request('sendChatAction', {
            chat_id: chatId,
            action: 'typing',
        });
    }

    async editMessageText(chatId: number, messageId: number, text: string): Promise<void> {
        await this.request('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text,
        });
    }

    async answerCallbackQuery(payload: TelegramAnswerCallbackQueryRequest): Promise<void> {
        await this.request('answerCallbackQuery', payload);
    }

    private async request<TResponse>(method: string, payload: unknown): Promise<TResponse> {
        const response = await fetch(`${this.apiBase}/${method}`, {
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
}
