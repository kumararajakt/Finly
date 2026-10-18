# AGENTS.md

Personal finance app: pnpm workspace with three packages.

- `client/` — React 19 + Vite + Tailwind v4 SPA. UI components in `src/components/ui` are shadcn-style but built on **Base UI (`@base-ui/react`)**, not Radix. Themes are CSS files in `src/themes/`. `@` aliases to `client/src`.
- `server/` — NestJS 11 API + Drizzle ORM (Postgres) + better-auth. Feature modules under `src/<feature>/` (controller/dto/service/module). All routes are under a global `api` prefix.
- `pdf-service/` — separate Python (FastAPI, uv-managed) service that extracts tables from PDF bank statements. The Nest server calls it (`PDF_SERVICE_URL`, default `localhost:8000`) and feeds the result through its normal CSV import pipeline — it does no categorization itself.

## Commands

```bash
pnpm install
pnpm dev                      # server + client + pdf-service via concurrently
pnpm --filter server start:dev
pnpm --filter client dev
pnpm --filter pdf-service setup   # one-time: uv sync (creates .venv)
pnpm --filter pdf-service dev

pnpm lint                     # eslint --fix (server) + oxlint (client)
pnpm test                     # server jest + pdf-service pytest
```

Focused:

```bash
pnpm --filter server test -- transactions.service   # one unit spec (jest name regex)
pnpm --filter server test:e2e                       # e2e — needs a live Postgres
pnpm --filter pdf-service test                      # pytest -q (skips politely if .venv missing)
pnpm --filter server db:generate                    # drizzle-kit generate from schema
pnpm --filter server db:migrate                     # apply migrations to DATABASE_URL
```

- Client has **no test runner** — verification is `pnpm --filter client build` (`tsc -b && vite build`).
- Client lint is `oxlint` only (config: `client/.oxlintrc.json`). Server lint runs with `--fix` baked in, so it rewrites files.

## Gotchas

- **`.gitignore` ignores `*.md`** — this file and any docs must be `git add -f`ed to be tracked (`client/README.md` was). Don't assume markdown changes show up in `git status`.
- **Server port mismatch**: code defaults to `PORT ?? 3000`, but the Vite dev proxy targets `http://localhost:3001`. Set `PORT=3001` in `server/.env` (copy from `server/.env.example`) or the client can't reach the API.
- **`BETTER_AUTH_URL` must be the client origin** (dev: `http://localhost:5173`), not the API origin, or OAuth breaks. In prod the client rewrites `/api/*` to the API project so cookies stay first-party; leave `VITE_API_URL` unset for the same reason. Details: `client/README.md`.
- Unit specs mock the Drizzle query chains by hand (see `transactions.service.spec.ts`) — no DB needed. All five `server/test/*.e2e-spec.ts` boot `AppModule` against a **real Postgres** (`DATABASE_URL`), and `server/test/helpers/auth.helper.ts` fabricates signed `finly.session_token` cookies so e2e avoids real OAuth.
- `better-auth` ships ESM `.mjs`; the jest config in `server/package.json` has a custom transform/`transformIgnorePatterns` for it. Don't "simplify" that config away.
- Migrations live in `server/drizzle/` and are generated from `server/src/database/schema.ts` — never hand-edit the SQL files. They're not run at boot by default; in the Vercel serverless entry (`server/api/index.js`) only if `AUTO_MIGRATE=true`.
- `client/` and `server/` each contain a stale `package-lock.json` alongside `pnpm-lock.yaml` — this repo is pnpm-managed; ignore the npm locks.
- `pnpm-workspace.yaml` allows build scripts only for `esbuild` and `unrs-resolver`; a new dependency needing a postinstall will be blocked until added there.

## Conventions

- Server: Prettier enforced via ESLint (`singleQuote`, `trailingComma: all`); DTOs validated with class-validator through a global `ValidationPipe` (whitelist + transform, 422 on failure). Errors go through `AllExceptionsFilter` — throw Nest exceptions with `{ message, code }` bodies.
- Deploy: two separate Vercel projects (`server/` and `client/` root dirs, configs in each `vercel.json`); the client project rewrites `/api/*` to the API. Deploy with `vercel --cwd server --prod` / `vercel --cwd client --prod`. Env var tables: `client/README.md` + `server/.env.example`.
