import { db } from '../drizzle/db';
import { toolApprovals } from '../drizzle/schema';

export interface ToolApprovalDecision {
    userId: string;
    toolName: string;
    toolArguments: unknown;
    approved: boolean;
    sessionId?: string;
}

export interface ToolApprovalAuditRepository {
    record(decision: ToolApprovalDecision): Promise<void>;
}

export class DrizzleToolApprovalAuditRepository implements ToolApprovalAuditRepository {
    async record(decision: ToolApprovalDecision): Promise<void> {
        await db.insert(toolApprovals).values({
            userId: decision.userId,
            sessionId: decision.sessionId ?? null,
            toolName: decision.toolName,
            toolArguments: decision.toolArguments as Record<string, unknown>,
            approved: decision.approved ? 1 : 0,
        });
    }
}
