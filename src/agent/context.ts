export interface AppContext {
    userId: string;
    userName: string;
    channel: 'telegram';
    telegramChatId: string;
    telegramUserId: string;
    locale?: string;
}
