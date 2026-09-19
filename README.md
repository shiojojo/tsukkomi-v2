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
STORAGE_BUCKET          # default: images
STORAGE_FOLDER          # default: line-sync (canonical catalog folder)
STORAGE_EXTRA_FOLDERS   # optional extra list prefixes; usually unset
```

LINE / image APIs (same `LINE_SYNC_API_KEY`):

| Method | Path | Role |
|--------|------|------|
| `POST` | `/api/line-ingest` | Sync text/image answers from GAS (see `docs/line-sync.md`) |
| `POST` | `/api/upload-image` | (Optional) Upload image bytes → Storage; prefer local CLI below |
| `GET` | `/api/unused-image-urls` | Storage − used topic image keys; GAS monthly sheet rebuild |

Image catalog flow: local upload → Storage `line-sync/` → GAS sheet「画像」holds unused public URLs → daily LINE pick from the sheet → answers sync creates topics → monthly rebuild drops used URLs. GAS triggers are documented in the `oogiriLineBot` README.

**Add images to the pool (preferred):**

1. Drop files into `local-images/inbox/` (any names).
2. Run `pnpm upload:images`
3. Files are normalized to JPEG (max edge 800, q75), uploaded, then moved to `local-images/done/<hash>.jpg` (same basename as Storage — no manual renaming).
4. Stdout `publicUrl` lines → sheet「画像」B (or GAS `appendImagePublicUrl`).

See `local-images/README.md` and `docs/image-upload.md`. Server `/api/upload-image` remains for compatibility; ingest of own Storage URLs does not re-process images.

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
- Reporting: see `SECURITY.md`. Code scanning: `.github/workflows/codeql.yml`.

## Dependency updates (ops)

Goal: clear Dependabot alerts without dual-managing versions or accidentally jumping majors.

**Do**

- Prefer **Dependabot** (security updates + weekly version updates in `.github/dependabot.yml`). Review the PR, run `pnpm test` / `pnpm run typecheck` (and a production build for router/SSR-sensitive changes), then merge.
- Or bump **direct** deps in `package.json` to the patched version yourself, then `pnpm install`, commit **both** `package.json` and `pnpm-lock.yaml`.
- Keep **declarations aligned** with what is installed. Alerts often look at `package.json`; fixing only via overrides leaves alerts open and creates dual management.
- Keep `pnpm.overrides` **slim and exact** (pin a concrete version). Use overrides only for transitive packages you cannot bump via a direct dependency.
- Keep the **react-router stack on one major**. Today that is `react-router` + `@react-router/*` + `@react-router/dev` all on **7.x** (e.g. `7.18.2`). Mixing `react-router@8` with `@react-router/*@7` caused production `ERR_REQUIRE_ESM` / Vercel 500.
- Use **Node.js 22.x** locally when changing deps (`nvm use 22`). `engines.node` is `22.x`; Vercel matches that.
- After dep changes, confirm install with frozen lockfile expectations: Vercel runs `pnpm install --frozen-lockfile`. Uncommitted lockfile changes break deploys (`LOCKFILE_CONFIG_MISMATCH`).
- Optional check: `pnpm run security:audit` (`audit-ci`).

**Do not**

- Do **not** use `pnpm audit --fix` as routine ops. It tends to write **open-ended overrides** instead of updating declarations, so you end up with dual management (`package.json` says old, overrides force new). That pulled `react-router@8` while `@react-router/*` stayed on 7 and took production down.
- Do not “align everything to latest” with broad `--latest` bumps unless you intend a planned major migration (and then update the whole matching stack together).
- Do not leave brand-new publishes to chance: `pnpm-workspace.yaml` sets `minimumReleaseAge` to 7 days; Dependabot cooldown is aligned. If a fix is newer than that window, wait or temporarily exclude that package — do not disable the policy permanently for convenience.

**Alerts vs PRs**

| Signal | Meaning |
|--------|---------|
| Dependabot **alert** | Known vuln in the graph / declared range |
| Dependabot **security update** PR | Auto PR when a fix exists (GitHub Settings toggle) |
| Dependabot **version update** PR | Routine bumps from `dependabot.yml` (even without a CVE) |

If the lockfile already has a safe version but `package.json` still declares a vulnerable range, **raise the declaration** (and trim the matching override). Dismiss an alert only when you have confirmed not affected / already fixed.

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
