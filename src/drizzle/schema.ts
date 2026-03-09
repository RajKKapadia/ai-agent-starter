import { pgTable, uuid, timestamp, jsonb, integer, index, unique, date, text, boolean, real } from 'drizzle-orm/pg-core';

/**
 * Sessions table - stores user session metadata
 * One session per userId for maintaining conversation history
 */
export const sessions = pgTable('sessions', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().unique(),
    sessionId: uuid('session_id').defaultRandom().notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Session items table - stores individual conversation items (messages, tool calls, etc.)
 * Items are stored as JSONB for flexibility with AgentInputItem structure
 */
export const sessionItems = pgTable('session_items', {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
        .references(() => sessions.sessionId, { onDelete: 'cascade' })
        .notNull(),
    itemData: jsonb('item_data').notNull(),
    sequence: integer('sequence').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
    // Index for efficient querying by session and sequence
    index('session_sequence_idx').on(table.sessionId, table.sequence),
    // Unique constraint to prevent duplicate sequences within a session
    unique('session_sequence_unique').on(table.sessionId, table.sequence),
]);

/**
 * Telegram users table - maps Telegram chat IDs to internal user IDs
 * Allows tracking which Telegram user corresponds to which user in the system
 */
export const telegramUsers = pgTable('telegram_users', {
    id: uuid('id').defaultRandom().primaryKey(),
    telegramChatId: text('telegram_chat_id').notNull().unique(),
    userId: text('user_id').notNull(),
    username: text('username'),
    firstName: text('first_name'),
    lastName: text('last_name'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    // Index for efficient lookup by telegram chat ID
    index('telegram_chat_id_idx').on(table.telegramChatId),
]);

/**
 * Tool approvals table - tracks approval requests and decisions
 * Useful for compliance, analytics, and audit trail
 */
export const toolApprovals = pgTable('tool_approvals', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    sessionId: uuid('session_id')
        .references(() => sessions.sessionId, { onDelete: 'cascade' }),
    toolName: text('tool_name').notNull(),
    toolArguments: jsonb('tool_arguments').notNull(),
    approved: integer('approved').notNull(), // 1 = approved, 0 = rejected
    approvedAt: timestamp('approved_at').defaultNow().notNull(),
}, (table) => [
    // Index for efficient querying by user and tool
    index('user_tool_idx').on(table.userId, table.toolName),
    index('session_approvals_idx').on(table.sessionId),
]);

/**
 * Token usage table - tracks LLM token consumption for analytics and billing
 */
export const tokenUsage = pgTable('token_usage', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    sessionId: uuid('session_id'),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    totalTokens: integer('total_tokens').notNull(),
    model: text('model'),
    operationType: text('operation_type'), // message, tool_call, guardrail
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
    index('token_usage_user_idx').on(table.userId),
    index('token_usage_created_at_idx').on(table.createdAt),
]);

// Type exports for use in queries
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type SessionItem = typeof sessionItems.$inferSelect;
export type NewSessionItem = typeof sessionItems.$inferInsert;
export type TelegramUser = typeof telegramUsers.$inferSelect;
export type NewTelegramUser = typeof telegramUsers.$inferInsert;
export type ToolApproval = typeof toolApprovals.$inferSelect;
export type NewToolApproval = typeof toolApprovals.$inferInsert;
export type TokenUsage = typeof tokenUsage.$inferSelect;
export type NewTokenUsage = typeof tokenUsage.$inferInsert;