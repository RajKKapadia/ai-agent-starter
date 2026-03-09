import { buildWeatherAgentInstructions } from './prompt';
import { currentDateTimeTool, fetchWeatherInformationTool } from './tool';
import { weatherInputGuardrail } from './guardrail';

export function createWeatherExample() {
    return {
        name: 'Weather Example Agent',
        instructions: buildWeatherAgentInstructions,
        tools: [currentDateTimeTool, fetchWeatherInformationTool],
        inputGuardrails: [weatherInputGuardrail],
    };
}
