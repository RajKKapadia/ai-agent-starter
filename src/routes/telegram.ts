import { InputGuardrailTripwireTriggered, run } from '@openai/agents';
import { Request, Response, Router } from 'express';

import { weatherAgent } from '../agent';
import { UserContext } from '../agent/context';
import { CustomSession } from '../agent/session';
import { appConfig } from '../env';
import { TelegramUpdate } from '../types';
import {
    handleCallbackQuery,
    handleInterruptions,
    sendMessage,
    sendTypingAction,
} from '../services/telegram';

const router = Router();

/**
 * POST /telegram/webhook
 * Receives incoming updates from Telegram
 * Protected by X-Telegram-Bot-Api-Secret-Token header
 */
router.post('/webhook', async (req: Request, res: Response) => {
    const secretToken = req.headers['x-telegram-bot-api-secret-token'];

    if (appConfig.TELEGRAM_X_SECRET_KEY && secretToken !== appConfig.TELEGRAM_X_SECRET_KEY) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const update = req.body as TelegramUpdate;
    if (!update) {
        res.status(400).json({ error: 'Invalid request body' });
        return;
    }

    res.status(200).json({ ok: true });

    if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
        return;
    }

    const message = update.message;
    if (!message?.text) {
        return;
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const senderName = message.from?.first_name ?? 'there';

    console.log(`[Telegram] Message from ${senderName} (${chatId}): ${text}`);

    try {
        await sendTypingAction(chatId);

        const userContext: UserContext = {
            userId: String(message.from?.id ?? chatId),
            name: [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || 'Unknown',
        };

        const session = new CustomSession({ userId: userContext.userId });
        const runResult = await run(weatherAgent, text, {
            context: userContext,
            stream: false,
            session,
        });

        if (runResult.interruptions.length > 0) {
            await handleInterruptions(runResult, chatId, userContext);
            return;
        }

        await sendMessage(chatId, String(runResult.finalOutput ?? 'Done.'));
    } catch (error) {
        if (error instanceof InputGuardrailTripwireTriggered) {
            await sendMessage(chatId, 'I can not help with this query.');
            return;
        }

        console.error('Error handling Telegram update:', error);
        await sendMessage(chatId, 'We are facing a technical issue.');
    }
});

export default router;
