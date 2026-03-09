const { runEnvTests } = require('./env.test.js');
const { runTelegramApprovalFlowTests } = require('./telegram-approval-flow.test.js');
const { runTelegramRouterTests } = require('./telegram-router.test.js');

const tests = [
    { name: 'env validation', run: runEnvTests },
    { name: 'telegram router', run: runTelegramRouterTests },
    { name: 'telegram approval flow', run: runTelegramApprovalFlowTests },
];

async function main() {
    let failures = 0;

    for (const testCase of tests) {
        try {
            await testCase.run();
            console.log(`PASS ${testCase.name}`);
        } catch (error) {
            failures += 1;
            console.error(`FAIL ${testCase.name}`);
            console.error(error);
        }
    }

    if (failures > 0) {
        process.exitCode = 1;
        return;
    }

    console.log(`PASS ${tests.length} tests`);
}

void main();
