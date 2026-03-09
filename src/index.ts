import { Server } from 'node:http';

import { OpenAIAgentRunner } from './application/agent-runner';
import { TelegramBotApplication } from './application/telegram-bot';
import { createApp } from './app';
import { closeDatabase, checkDatabaseHealth } from './drizzle/db';
import { getAppConfig } from './env';
import { RedisPendingApprovalStore } from './persistence/approval-state.store';
import { DrizzleToolApprovalAuditRepository } from './persistence/tool-approval.repository';
import { TelegramBotClient } from './services/telegram';
import { PendingApprovalState } from './types';

async function startServer(): Promise<{ server: Server; shutdown: () => Promise<void> }> {
    const config = getAppConfig();
    const pendingApprovalStore = new RedisPendingApprovalStore<PendingApprovalState>(config.REDIS_URL);
    await pendingApprovalStore.connect();

    const databaseReady = await checkDatabaseHealth();
    if (!databaseReady) {
        throw new Error('Database is not reachable during startup.');
    }

    const telegramBotApplication = new TelegramBotApplication(
        new TelegramBotClient(config.TELEGRAM_BOT_TOKEN),
        new OpenAIAgentRunner(),
        pendingApprovalStore,
        new DrizzleToolApprovalAuditRepository(),
    );

    const app = createApp({
        config,
        telegramBotApplication,
        pendingApprovalStore,
        databaseHealthcheck: checkDatabaseHealth,
    });

    const server = app.listen(config.PORT, () => {
        console.log(`Server is running on port ${config.PORT} (${config.NODE_ENV})`);
    });

    const shutdown = async (): Promise<void> => {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });

        await Promise.allSettled([
            pendingApprovalStore.disconnect(),
            closeDatabase(),
        ]);
    };

    return { server, shutdown };
}

void startServer().then(({ shutdown }) => {
    const handleSignal = (signal: NodeJS.Signals) => {
        console.log(`Received ${signal}. Shutting down.`);
        void shutdown().finally(() => process.exit(0));
    };

    process.once('SIGINT', handleSignal);
    process.once('SIGTERM', handleSignal);
}).catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
