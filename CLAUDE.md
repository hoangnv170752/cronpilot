# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev              # Start both server (port 3001) and Vite dev server (port 5173) concurrently
yarn dev:server       # Server only: node --watch server/src/index.js
yarn dev:client       # Client only: Vite dev server with /api proxy to port 3001

yarn test             # All tests (server then client)
yarn test:server      # Server tests via vitest.config.js
yarn test:client      # Client tests via vite.config.js

yarn build            # Vite build → client/dist/
yarn start            # yarn build + node server/src/index.js

yarn lint             # ESLint across entire repo
yarn lint:fix
yarn format           # Prettier
```

**Run a single test file:**

```bash
yarn test:server --reporter=verbose server/tests/jobs.test.js
yarn test:client --reporter=verbose client/tests/JobForm.test.jsx
```

## Architecture

### Server (`server/src/`)

Express app wired together in `index.js` → `app.js`. The server serves the built React client from `client/dist/` in production; in dev, the Vite proxy handles `/api` routing.

**Request flow:** `gatewayTokenMiddleware` → route handlers → `executor` / DB

- **`db/`** – Single module-level `db` singleton (`getDb()` / `initDb()`). SQLite in WAL mode with foreign keys. Schema and migrations are in `migrations.js` — all tables are created with `IF NOT EXISTS`.
- **`scheduler/index.js`** – `node-cron` tasks re-fetch the job from the DB on each tick (so config changes take effect immediately without rescheduling). Jobs are stored raw (integers for booleans) at this layer.
- **`scheduler/executor.js`** – Spawns child processes, caps output at 512 KB, enforces `EXEC_TIMEOUT_MS` (default 30 min). After completion, calls `ntfySend` and emits SSE events via `eventBus`.
- **`routes/jobs.js`** – `formatJob()` converts raw SQLite rows (integers) to typed JS objects (booleans) before sending to the client. All boolean DB columns are `0`/`1` integers — only `formatJob()` and the route write handlers deal with the conversion.
- **`services/eventBus.js`** – In-process EventEmitter. The SSE endpoint in `app.js` subscribes to `run:started` and `run:finished` events.
- **`services/ntfy.js`** – Fire-and-forget HTTP POST to the configured ntfy server. Errors are logged but never re-thrown.
- **`services/cronUtils.js`** – Uses `cron-parser` v5 (`CronExpressionParser.parse()`, not the old `parseExpression()`) and `cronstrue` for human-readable descriptions.
- **`env.js`** – Loads `.env` via dotenv (skipped in `NODE_ENV=test`). Exports `PROJECT_ROOT` (two directories up from `server/src/`). The version shown in the UI is read from root `package.json` by `app.js` at startup.

### Client (`client/src/`)

Single-page React app. State lives in hooks; components are presentational.

- **`api/client.js`** – Thin fetch wrapper; sends `X-Gateway-Token` header on every request (reads from URL `?token=`). Throws typed errors with `.fields` for validation responses.
- **`hooks/useJobs.js`** – Owns the jobs list state and all CRUD operations.
- **`hooks/useRunHistory.js`** – Paginated run history for a selected job.
- **`hooks/useJobEvents.js`** – SSE subscription (`/api/events`). Delivers `run:started` / `run:finished` to `App.jsx` which fans them out to `useJobs` and `useRunHistory`.
- **`hooks/useCronValidation.js`** – Debounced cron expression validation against `/api/jobs/validate`.
- **`components/`** – Organized by domain: `jobs/`, `runs/`, `cron/`, `ui/`, `layout/`, `auth/`.

### Build / Config

Single `package.json` at root. `vite.config.js` (root) sets `root: 'client'` so Vite treats `client/` as the project root; build output goes to `client/dist/`. `vitest.config.js` (root) scopes server tests to `server/tests/**`.

Client tests run in **happy-dom** (not jsdom). Server tests run in the node environment; `server/tests/setup.js` exposes `makeDb()`, `makeApp()`, and `makeScheduler()` helpers.

### ntfy Notification Logic

`ntfy_on_run` fires on **every** execution (success and error). `ntfy_on_error` fires only on failures, even when `ntfy_on_run` is off. Condition in `executor.js`:

```js
if (job.ntfy_enabled && ((isError && job.ntfy_on_error) || job.ntfy_on_run))
```

### Security

`GATEWAY_TOKEN` in `.env` enables the gateway. The token is passed as `?token=` in the URL for browser access (SSE cannot set custom headers). The middleware uses `timingSafeEqual` to prevent timing attacks.

### Coding

- You must not commit anything or create new branches unless I told you so
- Use ESM
- Document everything you add with proper JSDoc
