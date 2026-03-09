const assert = require('node:assert/strict');

const { TelegramBotApplication } = require('../dist/application/telegram-bot.js');

class InMemoryPendingApprovalStore {
    constructor() {
        this.values = new Map();
    }

    async connect() {}
    async disconnect() {}
    async save(key, value) { this.values.set(key, value); }
    async get(key) { return this.values.get(key) ?? null; }
    async delete(key) { this.values.delete(key); }
    async isReady() { return true; }
}

async function runTelegramApprovalFlowTests() {
    const sentMessages = [];
    const editedMessages = [];
    const auditLog = [];

    const telegramGateway = {
        async sendMessage(_chatId, text) {
            sentMessages.push(text);
            return { message_id: sentMessages.length };
        },
        async sendTypingAction() {},
        async editMessageText(_chatId, _messageId, text) {
            editedMessages.push(text);
        },
        async answerCallbackQuery() {},
    };

    let runCount = 0;
    const agentRunner = {
        async runText() {
            runCount += 1;
            return {
                pendingApproval: {
                    toolName: 'get_weather',
                    toolArguments: { city: 'Tokyo' },
                },
                serializedState: 'serialized-state',
            };
        },
        async resumePendingRun(_serializedState, _context, decision) {
            return {
                finalOutput: decision === 'approve' ? 'Weather result' : 'User rejected the call',
            };
        },
    };

    const pendingApprovalStore = new InMemoryPendingApprovalStore();
    const toolApprovalAuditRepository = {
        async record(decision) {
            auditLog.push({ approved: decision.approved, toolName: decision.toolName });
        },
    };

    const app = new TelegramBotApplication(
        telegramGateway,
        agentRunner,
        pendingApprovalStore,
        toolApprovalAuditRepository,
    );

    await app.handleUpdate({
        update_id: 1,
        message: {
            message_id: 1,
            date: 1,
            chat: { id: 99, type: 'private' },
            from: { id: 42, is_bot: false, first_name: 'Raj' },
            text: 'weather in Tokyo',
        },
    });

    assert.equal(runCount, 1);
    assert.equal(sentMessages[0].includes('Approval required'), true);
    assert.equal(pendingApprovalStore.values.size, 1);

    const approvalKey = Array.from(pendingApprovalStore.values.keys())[0];
    const approvalId = approvalKey.split(':').at(-1);

    await app.handleUpdate({
        update_id: 2,
        callback_query: {
            id: 'callback-1',
            chat_instance: 'instance',
            from: { id: 42, is_bot: false, first_name: 'Raj' },
            data: `approve:${approvalId}`,
            message: {
                message_id: 1,
                date: 1,
                chat: { id: 99, type: 'private' },
            },
        },
    });

    assert.equal(pendingApprovalStore.values.size, 0);
    assert.equal(editedMessages[0].includes('Approved'), true);
    assert.equal(sentMessages.at(-1), 'Weather result');
    assert.deepEqual(auditLog, [{ approved: true, toolName: 'get_weather' }]);
}

module.exports = { runTelegramApprovalFlowTests };
