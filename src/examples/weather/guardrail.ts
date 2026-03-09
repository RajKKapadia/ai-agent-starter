import { Agent, InputGuardrail, run } from '@openai/agents';
import z from 'zod';

import { AppContext } from '../../agent/context';
import { GUARDRAIL_MODEL } from '../../agent/config';
import { buildWeatherGuardrailInstructions } from './prompt';

const weatherGuardrailAgent = new Agent({
    name: 'Weather Guardrail',
    instructions: buildWeatherGuardrailInstructions,
    outputType: z.object({
        isWeather: z.boolean(),
        reasoning: z.string(),
    }),
    model: GUARDRAIL_MODEL,
});

export const weatherInputGuardrail: InputGuardrail = {
    name: 'Weather input guardrail',
    runInParallel: false,
    execute: async ({ input, context }) => {
        const result = await run(weatherGuardrailAgent, input, { context });
        return {
            outputInfo: result.finalOutput,
            tripwireTriggered: result.finalOutput?.isWeather === false,
        };
    },
};
