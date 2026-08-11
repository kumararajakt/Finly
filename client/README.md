# Finly — web client

Single-page React app (Vite + Tailwind v4 + Base UI) for Finly. The API is a NestJS server in `server/`; this repo is a pnpm workspace containing both.

```bash
pnpm install
pnpm dev            # runs server (port 3001) and client (Vite, proxies /api)
```

## Deploying to Vercel

The client and server deploy as **two separate Vercel projects** (they live on different origins, so cookies are cross-site):

| Project | Root directory | Config |
| --- | --- | --- |
| API | `server/` | `server/vercel.json` |
| Web client | `client/` | `client/vercel.json` |

### API project (`server/`)

- `server/api/index.ts` is a single serverless function that lazily bootstraps the Nest app once per warm lambda and hands the request to the underlying Express instance.
- `server/vercel.json` sets the build (`pnpm --filter server build`), bundles `server/drizzle/**` into the function so pending migrations can run at runtime, and caps `maxDuration` at 10s.
- First boot runs pending Drizzle migrations (unless `AUTO_MIGRATE=false`); the function resolves the migrations folder from the working directory or the compiled output.

Required environment variables:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (e.g. Neon, Supabase) |
| `SESSION_SECRET` | ≥ 32 chars, used to sign session cookies |
| `BETTER_AUTH_URL` | The deployed API origin, e.g. `https://finly-api.vercel.app` |
| `FINLY_OWNER_EMAIL` | Owner account email used by auth |
| `CORS_ORIGIN` | Comma-separated list of allowed client origins (e.g. `https://finly.vercel.app`); if unset, any origin is reflected (fine for a single-user app) |
| `AUTO_MIGRATE` | Optional; defaults to running migrations when `VERCEL=1` |
| `PG_POOL_MAX` | Optional; DB pool cap, default 3 to fit hosted-Postgres limits |

Cookies are `secure` and `sameSite: none` in production so the browser sends them across origins.

### Web client project (`client/`)

- `client/vercel.json` builds with `pnpm --filter client build` and rewrites every route to `index.html` (SPA fallback for react-router).
- Set the environment variable `VITE_API_URL` to the deployed API origin (no trailing slash), e.g. `https://finly-api.vercel.app`. When unset, the client calls relative `/api` (the Vite dev proxy targets `http://localhost:3001`).

Create both projects in the Vercel dashboard (setting each one's Root Directory) or deploy with the CLI: `vercel --cwd server --prod` and `vercel --cwd client --prod`.
