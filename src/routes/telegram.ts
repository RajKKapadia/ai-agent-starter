import { Request, Response, Router } from 'express';

import { TelegramBotApplication } from '../application/telegram-bot';
import { AppConfig } from '../env';
import { TelegramUpdate } from '../types';

export function createTelegramRouter(options: {
    telegramBotApplication: TelegramBotApplication;
    config: AppConfig;
}): Router {
    const router = Router();

    router.post('/webhook', (req: Request, res: Response) => {
        const secretToken = req.headers['x-telegram-bot-api-secret-token'];
        if (options.config.TELEGRAM_X_SECRET_KEY && secretToken !== options.config.TELEGRAM_X_SECRET_KEY) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const update = req.body as TelegramUpdate;
        if (!update) {
            res.status(400).json({ error: 'Invalid request body' });
            return;
        }

        res.status(200).json({ ok: true });
        void options.telegramBotApplication.handleUpdate(update).catch((error) => {
            console.error('Unhandled Telegram update error:', error);
        });
    });

    return router;
}
