# Finly — web client

Single-page React app (Vite + Tailwind v4 + Base UI) for Finly. The API is a NestJS server in `server/`; this repo is a pnpm workspace containing both.

```bash
pnpm install
pnpm dev            # runs server (port 3001) and client (Vite, proxies /api)
```

## Deploying to Vercel

The client and server deploy as **two separate Vercel projects**, but the client project rewrites `/api/*` to the server, so the browser only ever talks to the client origin:

| Project | Root directory | Config |
| --- | --- | --- |
| API | `server/` | `server/vercel.json` |
| Web client | `client/` | `client/vercel.json` |

### API project (`server/`)

- `server/api/index.ts` is a single serverless function that lazily bootstraps the Nest app once per warm lambda and hands the request to the underlying Express instance.
- `server/vercel.json` sets the build (`pnpm --filter server build`), bundles `server/drizzle/**` into the function so migrations can run there if needed, and caps `maxDuration` at 10s.
- Migrations are **not** run automatically at boot; run `pnpm --filter server db:migrate` before deploying, or set `AUTO_MIGRATE=true` to apply pending migrations on first boot (failures are non-fatal and logged, so the API still starts).

Required environment variables:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (e.g. Neon, Supabase) |
| `SESSION_SECRET` | ≥ 32 chars, used to sign session cookies |
| `BETTER_AUTH_URL` | Must be the **client origin** (the URL users see), e.g. `https://finly-client.vercel.app` — not the API origin. The OAuth callback hits this URL and is rewritten to the API, so the `finly.*` cookies (which are host-only) are always first-party. In dev this is already `http://localhost:5173`.
| `FINLY_OWNER_EMAIL` | Owner account email used by auth |
| `CORS_ORIGIN` | Comma-separated list of allowed client origins (e.g. `https://finly.vercel.app`); if unset, any origin is reflected (fine for a single-user app) |
| `AUTO_MIGRATE` | Optional; set to `true` to apply pending migrations on boot (default: off — migrate manually) |
| `PG_POOL_MAX` | Optional; DB pool cap, default 3 to fit hosted-Postgres limits |

Because `/api/*` is rewritten from the client origin, the OAuth and session cookies stay same-origin (first-party); the `secure` / `sameSite: none` attributes only matter if you bypass the rewrite.

### Web client project (`client/`)

- `client/vercel.json` builds with `pnpm --filter client build` and rewrites every route to `index.html` (SPA fallback for react-router). It also rewrites `/api/*` to the API project so the client and API share one origin.
- Leave `VITE_API_URL` **unset** so the client calls relative `/api`, which Vercel rewrites to the API. Do **not** point it at the API origin — a cross-origin API base makes Better Auth's state cookie third-party, and browsers block it, breaking Google login (`state_mismatch`). In dev, the Vite proxy targets `http://localhost:3001`.

Create both projects in the Vercel dashboard (setting each one's Root Directory) or deploy with the CLI: `vercel --cwd server --prod` and `vercel --cwd client --prod`.
