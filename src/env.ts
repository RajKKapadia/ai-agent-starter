import { config } from 'dotenv';
import { z } from 'zod';

config({ path: '.env.local' });

const requiredKeys = [
    'OPENAI_API_KEY',
    'OPENWEATHERMAP_API_KEY',
    'DATABASE_URL',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_X_SECRET_KEY',
] as const;

const appConfigSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    OPENAI_API_KEY: z.string(),
    OPENWEATHERMAP_API_KEY: z.string(),
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
    REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),
    TELEGRAM_BOT_TOKEN: z.string(),
    TELEGRAM_X_SECRET_KEY: z.string(),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

let cachedConfig: AppConfig | undefined;

export function buildAppConfig(env: NodeJS.ProcessEnv): AppConfig {
    const normalizedEnv: NodeJS.ProcessEnv = {
        ...env,
        REDIS_URL: env.REDIS_URL || (env.NODE_ENV === 'production' ? undefined : 'redis://localhost:6379'),
    };

    const missing = requiredKeys.filter((key) => !normalizedEnv[key] || String(normalizedEnv[key]).trim() === '');
    if (missing.length > 0) {
        throw new Error(`Invalid application configuration: ${missing.map((key) => `${key} is required`).join('; ')}`);
    }

    if (!normalizedEnv.REDIS_URL) {
        throw new Error('Invalid application configuration: REDIS_URL is required');
    }

    const result = appConfigSchema.safeParse(normalizedEnv);
    if (!result.success) {
        const issues = result.error.issues.map((issue) => issue.message).join('; ');
        throw new Error(`Invalid application configuration: ${issues}`);
    }

    return result.data;
}

export function getAppConfig(): AppConfig {
    if (!cachedConfig) {
        cachedConfig = buildAppConfig(process.env);
    }

    return cachedConfig;
}

export function validateConfig(): AppConfig {
    return getAppConfig();
}
