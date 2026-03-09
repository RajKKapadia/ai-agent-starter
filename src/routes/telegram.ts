import { Router, Request, Response } from 'express';

import { appConfig } from '../env';
import { sendMessage, sendTypingAction, TelegramUpdate } from '../services/telegram';
import { UserContext } from '../agent/context';
import { CustomSession } from '../agent/session';
import { weatherAgent } from '../agent';
import { InputGuardrailTripwireTriggered, run } from '@openai/agents';

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

    const update: TelegramUpdate = req.body;

    if (!update) {
        res.status(400).json({ error: 'Invalid request body' });
        return;
    }

    // Respond to Telegram immediately to avoid timeout
    res.status(200).json({ ok: true });

    const message = update.message;
    if (!message?.text) return;

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

        // Create session
        const session = new CustomSession({ userId: userContext.userId });

        // Run agent
        const runResult = await run(weatherAgent, text, { context: userContext, stream: false, session: session });

        // Check for interruptions (approval requests)
        if (runResult.interruptions && runResult.interruptions.length > 0) {
            // await handleInterruptions(runResult, chatId, userContext);
        } else {
            await sendMessage(chatId, runResult.finalOutput as string);
        }
    } catch (error) {
        if (error instanceof InputGuardrailTripwireTriggered) {
            // Guardrail rejected the query (not related to weather)
            await sendMessage(
                chatId,
                "I can not help with this query.",
            );
        } else {
            console.error('Error handling message:', error);
            await sendMessage(
                chatId,
                "We are facing a technical issue.",
            );
        }
    }
});

export default router;
