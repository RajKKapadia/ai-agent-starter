# AI Agent Starter

A Telegram-first starter for building approval-aware AI agents with the OpenAI Agents SDK, PostgreSQL, and Redis.

This template gives you a working baseline for:
- receiving Telegram webhook updates
- running an agent with persistent session history
- pausing on tool approvals
- storing interrupted run state in Redis
- resuming the run after user approval or rejection

The bundled domain example is weather, but the runtime is structured so you can replace that example without rewriting the Telegram or persistence layers.

## Features

- OpenAI Agents SDK integration
- Telegram webhook transport
- PostgreSQL-backed session history
- Redis-backed pending approval state
- resumable tool approval flow
- health and readiness endpoints
- replaceable example agent package
- basic test harness for key flows

## Project Structure

```text
src/
  app.ts                     Express app factory
  index.ts                   startup and shutdown wiring
  env.ts                     environment validation
  types.ts                   shared transport and persistence types
  agent/                     generic agent runtime and shared context
  application/               orchestration layer
  drizzle/                   database client and schema
  examples/weather/          replaceable example domain
  persistence/               Redis and DB persistence adapters
  routes/                    HTTP route registration
  services/                  external API clients
tests/                       lightweight integration-style tests
```

## Request Flow

1. Telegram sends an update to `POST /telegram/webhook`.
2. The route validates the webhook secret and forwards the update to the application layer.
3. The application layer runs the agent with the user context and persistent session.
4. If a tool requires approval, the serialized run state is stored in Redis and a Telegram inline keyboard is sent.
5. When the user clicks approve or reject, the callback is loaded, the saved run state is updated, and the agent resumes.
6. The final response is sent back to Telegram.

## Requirements

- Node.js 22+
- PostgreSQL
- Redis
- a Telegram bot token
- an OpenAI API key
- an OpenWeatherMap API key for the bundled example

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values.

```env
OPENAI_API_KEY=
OPENWEATHERMAP_API_KEY=
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/ai_agent_db
REDIS_URL=redis://localhost:6379
TELEGRAM_BOT_TOKEN=
TELEGRAM_X_SECRET_KEY=
```

Notes:
- `REDIS_URL` defaults to `redis://localhost:6379` outside production.
- In production, all required values must be set explicitly.

## Setup

1. Install dependencies.
```bash
npm install
```

2. Copy environment variables.
```bash
cp .env.example .env.local
```

3. Start PostgreSQL and Redis.

4. Run the app in development.
```bash
npm run dev
```

5. Expose your local server to Telegram with a tunnel such as ngrok, then register the webhook:
```bash
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook
```

Example request body:
```json
{
  "url": "https://your-public-url/telegram/webhook",
  "secret_token": "your-telegram-secret"
}
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run test
npm run lint
npm run format
```

## Health Endpoints

- `GET /healthz` returns process health
- `GET /readyz` checks database and Redis readiness

## Customizing The Template

If you want to build a different assistant:

1. Replace `src/examples/weather` with your own example package.
2. Export the new instructions, tools, and guardrails from that package.
3. Update `src/agent/index.ts` to bind the generic runtime to your new example.

You should not need to rewrite:
- Telegram webhook handling
- approval persistence and resume flow
- session persistence
- startup and shutdown wiring

## Testing

The current tests cover:
- environment validation
- Telegram route secret handling
- approval persistence and resume behavior

Run them with:
```bash
npm run test
```

## Development Notes

- The approval flow uses serialized `RunState` objects stored in Redis.
- Approval decisions are recorded in PostgreSQL for auditability.
- The current example marks the weather tool as `needsApproval: true` to demonstrate interruption handling.

## Next Steps

Common extensions after cloning this template:
- add more tools
- add additional channels beyond Telegram
- add structured logging
- add stronger test coverage around persistence and failure modes
- replace the weather example with your product-specific domain
