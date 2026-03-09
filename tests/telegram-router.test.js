const assert = require('node:assert/strict');
const http = require('node:http');

const { createApp } = require('../dist/app.js');

function createNoopStore() {
    return {
        async connect() {},
        async disconnect() {},
        async save() {},
        async get() { return null; },
        async delete() {},
        async isReady() { return true; },
    };
}

async function runTelegramRouterTests() {
    let receivedUpdate = 0;
    const telegramBotApplication = {
        async handleUpdate() {
            receivedUpdate += 1;
        },
    };

    const app = createApp({
        config: {
            NODE_ENV: 'test',
            PORT: 3000,
            OPENAI_API_KEY: 'key',
            OPENWEATHERMAP_API_KEY: 'weather',
            DATABASE_URL: 'postgresql://postgres:password@localhost:5432/app',
            REDIS_URL: 'redis://localhost:6379',
            TELEGRAM_BOT_TOKEN: 'bot',
            TELEGRAM_X_SECRET_KEY: 'secret',
        },
        telegramBotApplication,
        pendingApprovalStore: createNoopStore(),
        databaseHealthcheck: async () => true,
    });

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    try {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;

        const response = await fetch(`http://127.0.0.1:${port}/telegram/webhook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-telegram-bot-api-secret-token': 'secret',
            },
            body: JSON.stringify({ update_id: 1, message: { message_id: 1, date: 1, chat: { id: 1, type: 'private' }, text: 'hi' } }),
        });

        assert.equal(response.status, 200);
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.equal(receivedUpdate, 1);

        const unauthorized = await fetch(`http://127.0.0.1:${port}/telegram/webhook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-telegram-bot-api-secret-token': 'wrong',
            },
            body: JSON.stringify({ update_id: 2 }),
        });

        assert.equal(unauthorized.status, 401);
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
}

module.exports = { runTelegramRouterTests };
