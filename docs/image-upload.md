# Image Upload

Storage public URLs are the source of truth for LINE image odai (not Google Drive).

## Local CLI (only catalog upload path)

Drop photos into **`local-images/inbox/`** with any filenames, then:

```bash
# .env.local needs VITE_SUPABASE_URL + SUPABASE_SECRET_KEY
pnpm upload:images
pnpm upload:images -- --dry-run
```

- Always output **JPEG**: max edge **800px**, quality **75**, strip EXIF (orientation applied first)
- Moves each inbox file to **`local-images/done/<hash>.jpg`** (same name as the Storage object)
- Stdout: one `publicUrl` per line (paste into sheet「画像」B, or GAS `appendImagePublicUrl`)
- Stderr: progress / summary
- Optional paths: `pnpm upload:images -- ./other.png`
- Input: `jpg/png/webp/gif/heic` (non-recursive directory listing)
- Uses **devDependency** `sharp` on your machine only (not on Vercel)

There is **no** server `/api/upload-image`. Catalog writes go through this CLI.

## Relationship to `/api/line-ingest`

| Step | What |
|------|------|
| Add image to pool | `pnpm upload:images` → Storage → `publicUrl` |
| LINE shows odai | Sheet「画像」uses that `publicUrl` |
| Answers sync | `/api/line-ingest` requires `sourceImage` to already be this project's Storage public URL (reuses it; does not fetch/re-upload) |

## Env for CLI / unused API

- CLI: `VITE_SUPABASE_URL`, `SUPABASE_SECRET_KEY`; optional `STORAGE_BUCKET` / `STORAGE_FOLDER`
- Unused rebuild API still needs `LINE_SYNC_API_KEY` on the server (see below)

## Unused image URLs (monthly sheet rebuild)

- **Method:** `GET`
- **Path:** `/api/unused-image-urls`
- **Auth:** `X-API-KEY: <LINE_SYNC_API_KEY>`
- **Response:**

```json
{
  "ok": true,
  "urls": ["https://.../line-sync/abc.jpg"],
  "storageCount": 280,
  "storageUniqueKeyCount": 280,
  "usedUrlCount": 88,
  "usedKeyCount": 88,
  "usedTopicCount": 88,
  "unusedCount": 192,
  "folders": ["line-sync"]
}
```

Server computes **Storage − used image topics**, matching by **filename stem (hash)** so folder/extension differences do not matter.

LINE bot (`oogiriLineBot`):

- Daily 「写真」 / `linePushImage`: random from spreadsheet「画像」only (no API).
- Monthly (or manual): `cronRebuildUnusedImageSheet` / `rebuildUnusedImageSheet` replaces「画像」with this API’s `urls`. On API failure the sheet is left unchanged.

See the bot README for which GAS functions to put on triggers.
