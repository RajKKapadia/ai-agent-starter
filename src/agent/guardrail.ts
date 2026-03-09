import { Agent, InputGuardrail, run } from "@openai/agents";
import z from "zod";
import { GUARDRAIL_MODEL } from "./config";
import { buildGuardrailInstructions } from "./prompt";

const guardrailAgent = new Agent({
    name: 'Guardrail check',
    instructions: buildGuardrailInstructions,
    outputType: z.object({
        isWeather: z.boolean(),
        reasoning: z.string(),
    }),
    model: GUARDRAIL_MODEL,
});


export const weatherAgentGuardrail: InputGuardrail = {
    name: 'Weather Agent Guardrail',
    runInParallel: false,
    execute: async ({ input, context }) => {
        const result = await run(guardrailAgent, input, { context });
        return {
            outputInfo: result.finalOutput,
            tripwireTriggered: result.finalOutput?.isWeather === false,
        };
    },
};