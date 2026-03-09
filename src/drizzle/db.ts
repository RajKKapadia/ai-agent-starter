import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { getAppConfig } from '../env';
import * as schema from './schema';

const config = getAppConfig();
const client = postgres(config.DATABASE_URL, { max: 1 });

export const db = drizzle(client, { logger: config.NODE_ENV === 'development', schema });

export async function checkDatabaseHealth(): Promise<boolean> {
    try {
        await client`select 1`;
        return true;
    } catch {
        return false;
    }
}

export async function closeDatabase(): Promise<void> {
    await client.end();
}
