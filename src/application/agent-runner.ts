import { InputGuardrailTripwireTriggered, RunResult, RunState, run } from '@openai/agents';

import { primaryAgent } from '../agent';
import { AppContext } from '../agent/context';
import { CustomSession } from '../agent/session';

export interface AgentExecutionResult {
    finalOutput?: string;
    pendingApproval?: {
        toolName: string;
        toolArguments: unknown;
    };
    serializedState?: string;
}

export interface AgentRunner {
    runText(input: string, context: AppContext): Promise<AgentExecutionResult>;
    resumePendingRun(serializedState: string, context: AppContext, decision: 'approve' | 'reject'): Promise<AgentExecutionResult>;
}

export class UnsupportedAgentInputError extends Error {}

export class OpenAIAgentRunner implements AgentRunner {
    async runText(input: string, context: AppContext): Promise<AgentExecutionResult> {
        const result = await run(primaryAgent, input, {
            context,
            stream: false,
            session: new CustomSession({ userId: context.userId }),
        });

        return this.mapRunResult(result);
    }

    async resumePendingRun(serializedState: string, context: AppContext, decision: 'approve' | 'reject'): Promise<AgentExecutionResult> {
        const state = await RunState.fromString(primaryAgent, serializedState);
        const interruption = state.getInterruptions()[0];

        if (!interruption) {
            throw new Error('No pending interruption was found in serialized state.');
        }

        if (decision === 'approve') {
            state.approve(interruption);
        } else {
            state.reject(interruption, {
                message: 'The user rejected this tool call.',
            });
        }

        const result = await run(primaryAgent, state as RunState<AppContext, typeof primaryAgent>, {
            context,
            stream: false,
            session: new CustomSession({ userId: context.userId }),
        });

        return this.mapRunResult(result);
    }

    private mapRunResult(result: RunResult<any, any>): AgentExecutionResult {
        const interruption = result.interruptions[0];
        if (interruption) {
            return {
                pendingApproval: {
                    toolName: interruption.name ?? 'unknown_tool',
                    toolArguments: interruption.arguments,
                },
                serializedState: result.state.toString(),
            };
        }

        return {
            finalOutput: String(result.finalOutput ?? 'Done.'),
        };
    }
}

export { InputGuardrailTripwireTriggered };
