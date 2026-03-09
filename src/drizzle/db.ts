import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { appConfig } from '../env';
import * as schema from '../drizzle/schema';

// Create postgres client
const client = postgres(appConfig.DATABASE_URL as string);

// Create drizzle instance with the client
export const db = drizzle(client, { logger: true, schema: schema });
