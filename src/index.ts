import express from 'express';
import { appConfig, validateConfig } from './env';
import telegramRouter from './routes/telegram';

const app = express();

app.use(express.json());

/**
 * GET /
 * Home route - health check
 */
app.get('/', (_req, res) => {
    res.json({
        status: 'ok',
        message: 'AI Agent Server is running',
        environment: appConfig.NODE_ENV,
        timestamp: new Date().toISOString(),
    });
});

/**
 * Telegram webhook routes
 */
app.use('/telegram', telegramRouter);

app.listen(appConfig.PORT, () => {
    validateConfig();
    console.log(`Server is running on port ${appConfig.PORT} (${appConfig.NODE_ENV})`);
});

export default app;
