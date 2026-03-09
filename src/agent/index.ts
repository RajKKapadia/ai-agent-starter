import { Agent } from '@openai/agents';

import { UserContext } from './context';
import { AGENT_MODEL } from './config';
import {
    currentDateTimeTool,
    fetchWeatherInformation
} from './tool';
import { buildAgentInstructions } from './prompt';
import { weatherAgentGuardrail } from './guardrail';
import { recordTokenUsage } from '../services/tokenUsage.service';




export const weatherAgent = new Agent<UserContext>({
    name: 'Weather Agent',
    instructions: buildAgentInstructions,
    model: AGENT_MODEL,
    tools: [
        currentDateTimeTool,
        fetchWeatherInformation
    ],
    inputGuardrails: [weatherAgentGuardrail],
});

weatherAgent.on('agent_start', (ctx, agent) => {
    console.log(`[Agent] Started for user: ${ctx.context.userId}`);
});

weatherAgent.on('agent_end', async (ctx, output) => {
    console.log(`[Agent] Ended - Tokens: ${ctx.usage.totalTokens} (in: ${ctx.usage.inputTokens}, out: ${ctx.usage.outputTokens})`);

    // Record token usage to database
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

weatherAgent.on("agent_tool_start", (ctx, tool) => {
    console.log(`[Tool] ${tool.name} started`);
});

weatherAgent.on("agent_tool_end", async (ctx, tool, output) => {
    console.log(`[Tool] ${tool.name} ended - Tokens: ${ctx.usage.totalTokens}`);
    // Record token usage to database
    try {
        await recordTokenUsage({
            userId: ctx.context.userId,
            inputTokens: ctx.usage.inputTokens,
            outputTokens: ctx.usage.outputTokens,
            totalTokens: ctx.usage.totalTokens,
            model: AGENT_MODEL,
            operationType: "tool_call",
        });
    } catch (error) {
        console.error('[Agent] Failed to record token usage:', error);
    }
});
