import express, { Express } from 'express';

import { TelegramBotApplication } from './application/telegram-bot';
import { AppConfig } from './env';
import { PendingApprovalStore } from './persistence/approval-state.store';
import { PendingApprovalState } from './types';
import { createTelegramRouter } from './routes/telegram';

export function createApp(options: {
    config: AppConfig;
    telegramBotApplication: TelegramBotApplication;
    pendingApprovalStore: PendingApprovalStore<PendingApprovalState>;
    databaseHealthcheck: () => Promise<boolean>;
}): Express {
    const app = express();
    app.use(express.json());

    app.get('/healthz', (_req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    app.get('/readyz', async (_req, res) => {
        const [databaseReady, redisReady] = await Promise.all([
            options.databaseHealthcheck(),
            options.pendingApprovalStore.isReady(),
        ]);

        const ready = databaseReady && redisReady;
        res.status(ready ? 200 : 503).json({
            status: ready ? 'ready' : 'degraded',
            dependencies: {
                database: databaseReady,
                redis: redisReady,
            },
        });
    });

    app.get('/', (_req, res) => {
        res.json({
            status: 'ok',
            message: 'AI Agent Server is running',
            environment: options.config.NODE_ENV,
            timestamp: new Date().toISOString(),
        });
    });

    app.use('/telegram', createTelegramRouter({
        telegramBotApplication: options.telegramBotApplication,
        config: options.config,
    }));

    return app;
}
