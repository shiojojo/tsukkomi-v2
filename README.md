# Tsukkomi V2

React Router v7 SSR app for browsing topics, searching answers, voting, favorites, comments, and LINE answer ingestion.

## Runtime

- Node.js `22.x`
- pnpm `10.29.3`
- Vercel deployment uses the pinned pnpm version from `packageManager`

Do not use `npm install` for this repository. Commit `pnpm-lock.yaml` and `pnpm-workspace.yaml`.

## Setup

```bash
corepack enable
corepack prepare pnpm@10.29.3 --activate
pnpm install
```

Create `.env.local` from `.env.example` and fill in the values.

```bash
cp .env.example .env.local
```

Required local env keys:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLIC_KEY
SUPABASE_SECRET_KEY
LINE_SYNC_API_KEY
```

`SUPABASE_SECRET_KEY` and `LINE_SYNC_API_KEY` must not use a `VITE_` prefix.

Optional server-only env keys:

```text
STORAGE_BUCKET
STORAGE_FOLDER
```

LINE / image APIs (same `LINE_SYNC_API_KEY`):

- `POST /api/line-ingest` — sync answers (see `docs/line-sync.md`)
- `POST /api/upload-image` — upload image bytes to Supabase Storage (see `docs/image-upload.md`)

## Development

```bash
pnpm run dev
```

The app runs at `http://localhost:5173`.

## Tests

```bash
pnpm run typecheck
pnpm test
pnpm run test:e2e
pnpm run build
```

Playwright E2E tests intentionally run with `workers: 1` because they share login state and mutate the same Supabase-backed data.

If your local Node version is not `22.x`, pnpm may print an engine warning. Vercel uses Node `22.x`; local warnings do not matter as long as the commands pass.

For production-sensitive fixes, run both tests and a production build. React Router SSR can behave differently after Vite optimizes the server bundle, so do not rely on dev-server behavior alone when changing loaders, route data, or query parsing.

## Security Notes

- Public client env may use `VITE_`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLIC_KEY`.
- Server secrets must not use `VITE_`: `SUPABASE_SECRET_KEY`, `LINE_SYNC_API_KEY`.
- User authentication is intentionally not enforced in this app. Treat write endpoints and service-role access as server-side trust boundaries.
- Dependency install hardening is configured in `pnpm-workspace.yaml`.
- Dependency build scripts are denied by default. Only reviewed packages should be added to `allowBuilds`; currently approved packages are `sharp` and `esbuild`.
- Do not set `dangerouslyAllowAllBuilds: true`.
- Avoid broad helper functions that hide route-specific query parsing. The answers loader must use `parseAnswersFilterParams` so production builds keep `author`, `sortBy`, `minScore`, and `hasComments` filters.

## Build

```bash
pnpm run build
```

Build output:

```text
build/client/    static assets
build/server/    SSR server bundle
```

## Deployment

Vercel deployment details are in `DEPLOY_VERCEL.md`.
