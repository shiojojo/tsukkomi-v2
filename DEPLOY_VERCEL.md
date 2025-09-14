This project uses React Router v7 file-based routing with a Node SSR entry.

Quick steps to deploy to Vercel

1. Ensure the project is built during Vercel's build step. The repository includes `vercel.json` which:
   - Uses `@vercel/static-build` to publish `build/client` (Vite client assets)
   - Adds a Node serverless function at `api/index.js` which loads `build/server/index.js` and handles SSR.

2. In the Vercel dashboard, set the following Environment Variables (Project > Settings > Environment Variables):
   - VITE_SUPABASE_URL = https://<your-project>.supabase.co
   - VITE_SUPABASE_KEY = <your-anon-or-public-key>
   - SUPABASE_KEY = <your-service-role-key> (optional: only if server-side service key is needed)

3. Push to Git (main) and import the repo in Vercel. Vercel will run `npm run build`.

Notes and troubleshooting

- If build fails with Supabase errors, ensure the Vercel Build Environment variables include the `VITE_SUPABASE_*` values. In development the project uses `mock/` data when `import.meta.env.DEV === true`.
- Static assets (files with an extension) are served from `build/client` directly. All other paths are routed to the serverless function for SSR.

If you'd like, I can also add a tiny Vercel GitHub Action or update the README with a one-click deploy button.
