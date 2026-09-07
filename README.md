# Neuron OS

An AI-powered study assistant built with Next.js, Supabase, BullMQ, and Google Gemini.

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project with migrations applied (`supabase/migrations/`)
- A Redis instance (Railway managed Redis is used in production)
- Environment variables configured (see below)

### Local Development

1. Copy environment variables and fill in your values:
   ```bash
   # All required vars are listed in .env.local — fill these in before running
   ```

2. Start the Next.js dev server:
   ```bash
   npm run dev
   ```

3. **Important — the worker does NOT start automatically with `npm run dev`.**
   The BullMQ study-pack worker runs as a separate process. If you need to test
   the AI pipeline locally, start the worker in a second terminal:
   ```bash
   npm run worker:dev   # tsx watch mode — restarts on file changes
   # or
   npm run worker       # single run (no watch)
   ```

   > ⚠️ Do NOT set `ENABLE_INLINE_WORKER=true` in `.env.local`. That flag is
   > reserved for rare cases where the worker must run embedded inside the Next.js
   > process (e.g. a single-dyno hosting environment). It is not needed locally
   > and will cause a duplicate-worker race with the Railway production worker.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service-role key (server only) |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `GEMINI_MODEL` | ✅ | e.g. `gemini-2.5-flash` |
| `REDIS_URL` | ✅ | Redis connection string for BullMQ |
| `CRON_SECRET` | ✅ | Bearer token protecting cron endpoints |
| `OPENROUTER_API_KEY` | optional | Fallback AI provider |
| `WORKER_CONCURRENCY` | optional | BullMQ concurrency (default: 5) |
| `ENABLE_INLINE_WORKER` | ⚠️ do not set | Embeds worker inside Next.js process — not needed locally or in production |

## Production (Railway)

| Service | Start Command |
|---|---|
| Next.js App | `npm run start` |
| BullMQ Worker | `npm run worker` |
| Redis | Railway managed Redis |

The worker service and the Next.js app service are **separate Railway services**.
Do NOT set `ENABLE_INLINE_WORKER=true` on either — the worker service handles
job processing independently via `npm run worker`.

## Cron Endpoints

Protected by `Authorization: Bearer <CRON_SECRET>`. Trigger via Railway cron or any external scheduler.

| Route | Recommended Schedule | Purpose |
|---|---|---|
| `GET /api/cron/finalize-weekly-scores` | Weekly (Sunday 23:55 UTC) | Finalize scores, apply boosts |
| `GET /api/cron/check-stalled-jobs` | Every 5 minutes | Alert on stuck/stalled queue jobs |

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [BullMQ Documentation](https://docs.bullmq.io)
- [Supabase Documentation](https://supabase.com/docs)
