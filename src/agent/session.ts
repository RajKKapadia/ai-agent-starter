import type { AgentInputItem, Session } from '@openai/agents';
import { and, desc, eq, gte, max } from 'drizzle-orm';

import { db } from '../drizzle/db';
import { sessionItems, sessions } from '../drizzle/schema';

export class CustomSession implements Session {
    private readonly userId: string;
    private sessionIdCache?: string;

    constructor(options: { userId: string }) {
        this.userId = options.userId;
    }

    async getSessionId(): Promise<string> {
        if (this.sessionIdCache) {
            return this.sessionIdCache;
        }

        const existingSessions = await db
            .select()
            .from(sessions)
            .where(eq(sessions.userId, this.userId))
            .limit(1);

        if (existingSessions.length > 0) {
            this.sessionIdCache = existingSessions[0].sessionId;
            return this.sessionIdCache;
        }

        const [newSession] = await db
            .insert(sessions)
            .values({ userId: this.userId })
            .returning();

        this.sessionIdCache = newSession.sessionId;
        return this.sessionIdCache;
    }

    async getItems(limit?: number): Promise<AgentInputItem[]> {
        const sessionId = await this.getSessionId();

        if (limit !== undefined && limit > 0) {
            const maxSeqResult = await db
                .select({ maxSeq: max(sessionItems.sequence) })
                .from(sessionItems)
                .where(eq(sessionItems.sessionId, sessionId));

            const maxSeq = maxSeqResult[0]?.maxSeq;
            if (maxSeq !== null && maxSeq !== undefined) {
                const startSeq = Math.max(0, maxSeq - limit + 1);
                const limitedItems = await db
                    .select()
                    .from(sessionItems)
                    .where(and(eq(sessionItems.sessionId, sessionId), gte(sessionItems.sequence, startSeq)))
                    .orderBy(sessionItems.sequence);

                return limitedItems.map((item) => this.cloneItem(item.itemData as AgentInputItem));
            }
        }

        const items = await db
            .select()
            .from(sessionItems)
            .where(eq(sessionItems.sessionId, sessionId))
            .orderBy(sessionItems.sequence);

        return items.map((item) => this.cloneItem(item.itemData as AgentInputItem));
    }

    async addItems(items: AgentInputItem[]): Promise<void> {
        if (items.length === 0) {
            return;
        }

        const sessionId = await this.getSessionId();

        await db.transaction(async (tx) => {
            const maxSeqResult = await tx
                .select({ maxSeq: max(sessionItems.sequence) })
                .from(sessionItems)
                .where(eq(sessionItems.sessionId, sessionId));

            const currentMaxSeq = maxSeqResult[0]?.maxSeq ?? -1;
            const itemsToInsert = items.map((item, index) => ({
                sessionId,
                itemData: item as never,
                sequence: currentMaxSeq + index + 1,
            }));

            await tx.insert(sessionItems).values(itemsToInsert);
            await tx.update(sessions).set({ updatedAt: new Date() }).where(eq(sessions.sessionId, sessionId));
        });
    }

    async popItem(): Promise<AgentInputItem | undefined> {
        const sessionId = await this.getSessionId();

        return db.transaction(async (tx) => {
            const lastItems = await tx
                .select()
                .from(sessionItems)
                .where(eq(sessionItems.sessionId, sessionId))
                .orderBy(desc(sessionItems.sequence))
                .limit(1);

            if (lastItems.length === 0) {
                return undefined;
            }

            const lastItem = lastItems[0];
            await tx.delete(sessionItems).where(eq(sessionItems.id, lastItem.id));
            await tx.update(sessions).set({ updatedAt: new Date() }).where(eq(sessions.sessionId, sessionId));
            return this.cloneItem(lastItem.itemData as AgentInputItem);
        });
    }

    async clearSession(): Promise<void> {
        const sessionId = await this.getSessionId();

        await db.transaction(async (tx) => {
            await tx.delete(sessionItems).where(eq(sessionItems.sessionId, sessionId));
            await tx.update(sessions).set({ updatedAt: new Date() }).where(eq(sessions.sessionId, sessionId));
        });
    }

    private cloneItem<T extends AgentInputItem>(item: T): T {
        return structuredClone(item);
    }
}
