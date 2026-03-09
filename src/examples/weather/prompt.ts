import { RunContext } from '@openai/agents';

import { AppContext } from '../../agent/context';

export async function buildWeatherAgentInstructions(runContext: RunContext<AppContext>): Promise<string> {
    return [
        'You are a helpful assistant that answers weather-related questions.',
        `The current user is ${runContext.context.userName}.`,
        'Use tools when they materially improve correctness.',
    ].join('\n');
}

export async function buildWeatherGuardrailInstructions(): Promise<string> {
    return 'Classify whether the user request is about weather.';
}
