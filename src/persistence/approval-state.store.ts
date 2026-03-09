import Redis from 'ioredis';

export interface PendingApprovalStore<TState> {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    save(key: string, value: TState, ttlSeconds: number): Promise<void>;
    get(key: string): Promise<TState | null>;
    delete(key: string): Promise<void>;
    isReady(): Promise<boolean>;
}

export class RedisPendingApprovalStore<TState> implements PendingApprovalStore<TState> {
    private readonly client: Redis;

    constructor(redisUrl: string) {
        this.client = new Redis(redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => Math.min(times * 100, 2000),
        });

        this.client.on('connect', () => {
            console.log('Redis connected');
        });

        this.client.on('error', (error) => {
            console.error('Redis connection error:', error);
        });
    }

    async connect(): Promise<void> {
        if (this.client.status === 'ready' || this.client.status === 'connecting' || this.client.status === 'connect') {
            return;
        }

        await this.client.connect();
    }

    async disconnect(): Promise<void> {
        if (this.client.status === 'end') {
            return;
        }

        await this.client.quit();
    }

    async save(key: string, value: TState, ttlSeconds: number): Promise<void> {
        await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    }

    async get(key: string): Promise<TState | null> {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) as TState : null;
    }

    async delete(key: string): Promise<void> {
        await this.client.del(key);
    }

    async isReady(): Promise<boolean> {
        try {
            const response = await this.client.ping();
            return response === 'PONG';
        } catch {
            return false;
        }
    }
}
