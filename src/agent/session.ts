import type { Session, AgentInputItem } from '@openai/agents';
import { eq, desc, and, max } from 'drizzle-orm';
import { db } from '../drizzle/db';
import { sessions, sessionItems } from '../drizzle/schema';

/**
 * Custom session implementation
 * Stores conversation history in PostgreSQL database using Drizzle ORM
 * One session per userId for maintaining full conversation context
 */
export class CustomSession implements Session {
    private readonly userId: string;
    private sessionIdCache?: string;

    constructor(options: { userId: string }) {
        this.userId = options.userId;
    }

    /**
     * Get or create session ID for this user
     * Uses cached value after first retrieval
     */
    async getSessionId(): Promise<string> {
        try {
            if (this.sessionIdCache) {
                return this.sessionIdCache;
            }

            // Try to find existing session
            const existingSessions = await db
                .select()
                .from(sessions)
                .where(eq(sessions.userId, this.userId))
                .limit(1);

            if (existingSessions.length > 0) {
                this.sessionIdCache = existingSessions[0].sessionId;
                return this.sessionIdCache;
            }

            // Create new session if doesn't exist
            const [newSession] = await db
                .insert(sessions)
                .values({
                    userId: this.userId,
                })
                .returning();

            this.sessionIdCache = newSession.sessionId;
            return this.sessionIdCache;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get all session items (conversation history)
     * @param limit Optional limit on number of items to return (most recent)
     */
    async getItems(limit?: number): Promise<AgentInputItem[]> {
        try {
            const sessionId = await this.getSessionId();
            // Build query
            let query = db
                .select()
                .from(sessionItems)
                .where(eq(sessionItems.sessionId, sessionId))
                .orderBy(sessionItems.sequence);

            // Apply limit if provided (get most recent items)
            if (limit !== undefined && limit > 0) {
                // Get max sequence first to calculate offset
                const maxSeqResult = await db
                    .select({ maxSeq: max(sessionItems.sequence) })
                    .from(sessionItems)
                    .where(eq(sessionItems.sessionId, sessionId));

                const maxSeq = maxSeqResult[0]?.maxSeq;
                if (maxSeq !== null && maxSeq !== undefined) {
                    const startSeq = Math.max(0, maxSeq - limit + 1);
                    query = db
                        .select()
                        .from(sessionItems)
                        .where(
                            and(
                                eq(sessionItems.sessionId, sessionId),
                                // Get items with sequence >= startSeq
                            )
                        )
                        .orderBy(sessionItems.sequence);
                }
            }

            const items = await query;

            // Parse JSONB data and return cloned items
            const result = items.map(item => this.cloneItem(item.itemData as AgentInputItem));
            return result;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Add new items to the session
     * @param items Array of items to add
     */
    async addItems(items: AgentInputItem[]): Promise<void> {
        try {
            if (items.length === 0) {
                return;
            }

            const sessionId = await this.getSessionId();

            await db.transaction(async (tx) => {
                // Get current max sequence
                const maxSeqResult = await tx
                    .select({ maxSeq: max(sessionItems.sequence) })
                    .from(sessionItems)
                    .where(eq(sessionItems.sessionId, sessionId));

                const currentMaxSeq = maxSeqResult[0]?.maxSeq ?? -1;
                const startSeq = currentMaxSeq + 1;

                // Insert all items with sequential numbering
                const itemsToInsert = items.map((item, idx) => ({
                    sessionId,
                    itemData: item as any, // JSONB column accepts any JSON-serializable data
                    sequence: startSeq + idx,
                }));

                await tx.insert(sessionItems).values(itemsToInsert);

                // Update session updated_at timestamp
                await tx
                    .update(sessions)
                    .set({ updatedAt: new Date() })
                    .where(eq(sessions.sessionId, sessionId));
            });

        } catch (error) {
            throw error;
        }
    }

    /**
     * Remove and return the last item from the session
     * Useful for "undo" functionality
     */
    async popItem(): Promise<AgentInputItem | undefined> {
        try {
            const sessionId = await this.getSessionId();

            return await db.transaction(async (tx) => {
                // Get the last item
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

                // Delete the item
                await tx
                    .delete(sessionItems)
                    .where(eq(sessionItems.id, lastItem.id));

                // Update session timestamp
                await tx
                    .update(sessions)
                    .set({ updatedAt: new Date() })
                    .where(eq(sessions.sessionId, sessionId));

                const result = this.cloneItem(lastItem.itemData as AgentInputItem);
                return result;
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Clear all items from the session
     * Keeps the session record for metadata
     */
    async clearSession(): Promise<void> {
        try {
            const sessionId = await this.getSessionId();

            await db.transaction(async (tx) => {
                // Delete all items (cascade handles this, but explicit for clarity)
                await tx
                    .delete(sessionItems)
                    .where(eq(sessionItems.sessionId, sessionId));

                // Update session timestamp
                await tx
                    .update(sessions)
                    .set({ updatedAt: new Date() })
                    .where(eq(sessions.sessionId, sessionId));
            });

        } catch (error) {
            throw error;
        }
    }

    /**
     * Deep clone an item to prevent mutations
     */
    private cloneItem<T extends AgentInputItem>(item: T): T {
        return structuredClone(item);
    }
}