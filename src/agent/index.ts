import { Agent, type InputGuardrail, type Tool } from '@openai/agents';

import { AGENT_MODEL } from './config';
import { AppContext } from './context';
import { createWeatherExample } from '../examples/weather';
import { recordTokenUsage } from '../persistence/token-usage.service';

const weatherExample = createWeatherExample();

export const primaryAgent = new Agent<AppContext>({
    name: weatherExample.name,
    instructions: weatherExample.instructions,
    model: AGENT_MODEL,
    tools: weatherExample.tools as Tool<AppContext>[],
    inputGuardrails: weatherExample.inputGuardrails as InputGuardrail[],
});

primaryAgent.on('agent_start', (ctx) => {
    console.log(`[Agent] Started for user: ${ctx.context.userId}`);
});

primaryAgent.on('agent_end', async (ctx) => {
    console.log(`[Agent] Ended - Tokens: ${ctx.usage.totalTokens} (in: ${ctx.usage.inputTokens}, out: ${ctx.usage.outputTokens})`);

    try {
        await recordTokenUsage({
            userId: ctx.context.userId,
            inputTokens: ctx.usage.inputTokens,
            outputTokens: ctx.usage.outputTokens,
            totalTokens: ctx.usage.totalTokens,
            model: AGENT_MODEL,
            operationType: 'message',
        });
    } catch (error) {
        console.error('[Agent] Failed to record token usage:', error);
    }
});

primaryAgent.on('agent_tool_start', (_ctx, tool) => {
    console.log(`[Tool] ${tool.name} started`);
});

primaryAgent.on('agent_tool_end', async (ctx, tool) => {
    console.log(`[Tool] ${tool.name} ended - Tokens: ${ctx.usage.totalTokens}`);

    try {
        await recordTokenUsage({
            userId: ctx.context.userId,
            inputTokens: ctx.usage.inputTokens,
            outputTokens: ctx.usage.outputTokens,
            totalTokens: ctx.usage.totalTokens,
            model: AGENT_MODEL,
            operationType: 'tool_call',
        });
    } catch (error) {
        console.error('[Agent] Failed to record token usage:', error);
    }
});
