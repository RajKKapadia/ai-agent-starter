# AI Agent Starter

Telegram-first starter for an OpenAI Agents workflow with PostgreSQL session persistence, Redis-backed tool approvals, and a replaceable example domain package.

## Architecture
- `src/application`: orchestration layer that coordinates transport, agent execution, approvals, and error handling.
- `src/agent`: generic agent runtime and shared app context.
- `src/examples/weather`: example prompts, tools, and guardrails that can be swapped without editing transport or persistence code.
- `src/drizzle` and `src/persistence`: durable storage and infra adapters.
- `src/services`: external transport clients, currently Telegram.

## Request Flow
1. Telegram posts an update to `/telegram/webhook`.
2. The route validates the secret and hands the update to the application layer.
3. The application layer runs the agent or resumes a serialized run state.
4. If a tool needs approval, the run state is stored in Redis and an inline approval message is sent.
5. When the callback arrives, the stored state is loaded, updated, and resumed.

## Setup
1. Copy `.env.example` to `.env.local`.
2. Fill in the OpenAI, Telegram, Postgres, Redis, and weather API credentials.
3. Start PostgreSQL and Redis locally.
4. Run `npm run build` or `npm run dev`.

## Quality Gates
- `npm run build`
- `npm run test`
- `npm run lint`
- `npm run format`

## Swapping The Example Agent
Replace `src/examples/weather` with a new example package that exports tools, instructions, and guardrails. The rest of the runtime should not need transport or persistence changes.
