import { RunContext } from "@openai/agents"
import { UserContext } from "./context"

export const buildAgentInstructions = async (runContext: RunContext<UserContext>): Promise<string> => {
    return `You are a helpful assistant, help user get weather information.\n
    User name is: ${runContext.context.name}.`
}

export const buildGuardrailInstructions = async (runContext: RunContext<UserContext>): Promise<string> => {
    return `Check if user is asking about weather information.`
}