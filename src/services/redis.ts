import Redis from 'ioredis';
import { appConfig } from '../env';

// Initialize Redis client
const redis = new Redis(appConfig.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    lazyConnect: true,
});

// Connection event handlers
redis.on('connect', () => {
    console.log('✅ Redis connected successfully');
});

redis.on('error', (error) => {
    console.error('❌ Redis connection error:', error);
});

redis.on('ready', () => {
    console.log('🚀 Redis is ready to accept commands');
});

// Connect to Redis
redis.connect().catch((error) => {
    console.error('Failed to connect to Redis:', error);
});

/**
 * Store pending approval state in Redis
 * @param key - Unique key for the pending state
 * @param value - Serialized state data
 * @param ttlSeconds - Time to live in seconds (default: 600 = 10 minutes)
 */
export async function storePendingState(
    key: string,
    value: string,
    ttlSeconds: number = 600
): Promise<void> {
    await redis.setex(key, ttlSeconds, value);
}

/**
 * Retrieve pending approval state from Redis
 * @param key - Unique key for the pending state
 * @returns Serialized state data or null if not found/expired
 */
export async function getPendingState(key: string): Promise<string | null> {
    return await redis.get(key);
}

/**
 * Delete pending approval state from Redis
 * @param key - Unique key for the pending state
 */
export async function deletePendingState(key: string): Promise<void> {
    await redis.del(key);
}

/**
 * Check if a pending state exists
 * @param key - Unique key for the pending state
 * @returns true if exists, false otherwise
 */
export async function pendingStateExists(key: string): Promise<boolean> {
    const exists = await redis.exists(key);
    return exists === 1;
}

/**
 * Get remaining TTL for a pending state
 * @param key - Unique key for the pending state
 * @returns TTL in seconds, -1 if key exists but has no TTL, -2 if key doesn't exist
 */
export async function getPendingStateTTL(key: string): Promise<number> {
    return await redis.ttl(key);
}

/**
 * Close Redis connection (useful for graceful shutdown)
 */
export async function closeRedis(): Promise<void> {
    await redis.quit();
    console.log('Redis connection closed');
}

export default redis;
