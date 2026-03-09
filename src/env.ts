import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

// Export configuration with proper typing and defaults
export const appConfig = {
    PORT: parseInt(process.env.PORT || '8080', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    DATABASE_URL: process.env.DATABASE_URL || '',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
    TELEGRAM_X_SECRET_KEY: process.env.TELEGRAM_X_SECRET_KEY || '',
    OPENWEATHERMAP_API_KEY: process.env.OPENWEATHERMAP_API_KEY || ''
} as const;

// Validation function (optional - can be called at startup)
export const validateConfig = (): boolean => {
    const errors: string[] = [];

    if (!appConfig.OPENAI_API_KEY) {
        errors.push('OPENAI_API_KEY is not set');
    }

    if (!appConfig.DATABASE_URL) {
        errors.push('DATABASE_URL is not set');
    }

    if (!appConfig.TELEGRAM_BOT_TOKEN) {
        errors.push('TELEGRAM_BOT_TOKEN is not set - Telegram webhook will not work');
    }

    if (!appConfig.TELEGRAM_X_SECRET_KEY) {
        errors.push('TELEGRAM_X_SECRET_KEY is not set - webhook will be unprotected');
    }

    if (errors.length > 0) {
        console.warn('⚠️  Configuration warnings:');
        errors.forEach(error => console.warn(`   - ${error}`));
    }

    return errors.length === 0;
};