const assert = require('node:assert/strict');

const { buildAppConfig } = require('../dist/env.js');

async function runEnvTests() {
    assert.throws(() => buildAppConfig({ NODE_ENV: 'development' }), /OPENAI_API_KEY is required/);

    const config = buildAppConfig({
        NODE_ENV: 'development',
        PORT: '3000',
        OPENAI_API_KEY: 'test-openai-key',
        OPENWEATHERMAP_API_KEY: 'test-weather-key',
        DATABASE_URL: 'postgresql://postgres:password@localhost:5432/app',
        REDIS_URL: 'redis://localhost:6379',
        TELEGRAM_BOT_TOKEN: 'telegram-token',
        TELEGRAM_X_SECRET_KEY: 'secret-token',
    });

    assert.equal(config.PORT, 3000);
    assert.equal(config.REDIS_URL, 'redis://localhost:6379');
}

module.exports = { runEnvTests };
