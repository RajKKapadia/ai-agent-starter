import { desc, eq, sum } from 'drizzle-orm';

import { db } from '../drizzle/db';
import { tokenUsage } from '../drizzle/schema';
import type { NewTokenUsage, TokenUsage } from '../drizzle/schema';

export interface RecordTokenUsageParams {
    userId: string;
    sessionId?: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    model?: string;
    operationType?: string;
}

export async function recordTokenUsage(params: RecordTokenUsageParams): Promise<TokenUsage> {
    const record: NewTokenUsage = {
        userId: params.userId,
        sessionId: params.sessionId ?? null,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        totalTokens: params.totalTokens,
        model: params.model ?? null,
        operationType: params.operationType ?? null,
    };

    const [inserted] = await db.insert(tokenUsage).values(record).returning();
    return inserted;
}

export async function getTotalTokenUsageByUser(userId: string): Promise<{
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
}> {
    const [result] = await db
        .select({
            inputTokens: sum(tokenUsage.inputTokens),
            outputTokens: sum(tokenUsage.outputTokens),
            totalTokens: sum(tokenUsage.totalTokens),
        })
        .from(tokenUsage)
        .where(eq(tokenUsage.userId, userId));

    return {
        inputTokens: Number(result?.inputTokens ?? 0),
        outputTokens: Number(result?.outputTokens ?? 0),
        totalTokens: Number(result?.totalTokens ?? 0),
    };
}

export async function getRecentTokenUsage(userId: string, limit = 20): Promise<TokenUsage[]> {
    return db
        .select()
        .from(tokenUsage)
        .where(eq(tokenUsage.userId, userId))
        .orderBy(desc(tokenUsage.createdAt))
        .limit(limit);
}
