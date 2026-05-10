# Vercel Deployment

This project deploys a React Router v7 SSR build to Vercel.

## Build Settings

The repository includes `vercel.json`.

- Install command: `corepack enable && corepack prepare pnpm@10.29.3 --activate && pnpm install --frozen-lockfile`
- Build command: `pnpm run build`
- Output directory: `build/client`
- Node.js: `22.x`

`package.json` pins:

```json
"packageManager": "pnpm@10.29.3",
"engines": {
  "node": "22.x",
  "pnpm": ">=10.26.0 <11"
}
```

## Environment Variables

Set these in Vercel Project Settings for each target environment that runs the app.

```text
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLIC_KEY=<your-publishable-or-anon-key>
SUPABASE_SECRET_KEY=<your-service-role-key>
LINE_SYNC_API_KEY=<shared-secret-for-line-ingest>
```

Optional:

```text
STORAGE_BUCKET=images
STORAGE_FOLDER=line-sync
```

Important:

- Do not create `VITE_SUPABASE_SECRET_KEY`.
- Do not create `VITE_LINE_SYNC_API_KEY`.
- Any `VITE_` variable can be bundled into client code.
- `SUPABASE_SECRET_KEY` is required for server-side answer search and favorites.

## Dependency Security

pnpm security hardening is configured in `pnpm-workspace.yaml`.

- `minimumReleaseAge: 10080`
- `blockExoticSubdeps: true`
- `trustPolicy: no-downgrade`
- `allowBuilds` currently allows only reviewed build-script dependencies.
- `dangerouslyAllowAllBuilds: false`
- `strictDepBuilds: true`

If install fails because a package wants to run a build script, review it locally with:

```bash
pnpm approve-builds
```

Only add reviewed packages to `allowBuilds`. Do not bypass this with `dangerouslyAllowAllBuilds: true`.

## Troubleshooting

- If `/topics` works but `/answers` or `/answers/favorites` fails, check `SUPABASE_SECRET_KEY` in the Vercel runtime environment.
- If build logs mention Node `24.x`, check that `package.json` still says `"node": "22.x"`.
- If install logs do not mention pnpm `10.29.3`, check `packageManager` and `ENABLE_EXPERIMENTAL_COREPACK` if your Vercel project requires it.
- Sharp is pinned to `0.32.6`; do not upgrade it without testing the Vercel runtime image path.
