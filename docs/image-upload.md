# Image Upload API

Upload image bytes to Supabase Storage via tsukkomi-v2. Storage public URLs are the source of truth for LINE image odai (not Google Drive).

## Endpoint

- **Method:** `POST`
- **Path:** `/api/upload-image`
- **Auth:** `X-API-KEY: <LINE_SYNC_API_KEY>`
- **Side effects:** Writes to Supabase Storage only. Does **not** create a `topics` row (topics are created by `/api/line-ingest` when answers sync).

### Body options

1. **multipart/form-data** (recommended)

   - Field name: `file` or `image`
   - Max size: 10 MiB
   - Allowed types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`

2. **Raw body**

   - `Content-Type: image/jpeg` (or png / webp / gif)
   - Body = image bytes

### Response

```json
{
  "ok": true,
  "path": "line-sync/<hash>.jpg",
  "publicUrl": "https://<project>.supabase.co/storage/v1/object/public/images/line-sync/<hash>.jpg"
}
```

Put `publicUrl` into the LINE bot spreadsheet sheet **画像** column B (GAS `appendImagePublicUrl`, or wait for the monthly unused rebuild).

### Example (curl)

```bash
curl -X POST "https://<your-host>/api/upload-image" \
  -H "X-API-KEY: $LINE_SYNC_API_KEY" \
  -F "file=@./photo.jpg"
```

## Relationship to `/api/line-ingest`

| Step | API | What happens |
|------|-----|----------------|
| Add image to pool | `/api/upload-image` | Bytes → Storage → `publicUrl` |
| LINE shows odai | (sheet) | Uses `publicUrl` from **画像** sheet |
| Answers sync | `/api/line-ingest` | If `sourceImage` is already this project's Storage public URL, **skips re-upload** and stores it on the topic |

## Server config

- `LINE_SYNC_API_KEY`
- `SUPABASE_SECRET_KEY` (required for Storage writes)
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLIC_KEY`
- Optional: `STORAGE_BUCKET` (default `images`), `STORAGE_FOLDER` (default `line-sync`)

Images are resized (max width 800) via `imageProcessor` when possible.

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
