# Image Upload API

Upload image bytes to Supabase Storage via tsukkomi-v2. Use this instead of Google Drive as the source of truth for LINE image odai.

## Endpoint

- **Method:** `POST`
- **Path:** `/api/upload-image`
- **Auth:** `X-API-KEY: <LINE_SYNC_API_KEY>`
- **Side effects:** Writes to Supabase Storage only. Does **not** create a `topics` row (topics are still created by `/api/line-ingest` when answers sync).

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

Put `publicUrl` into the LINE bot spreadsheet sheet **画像** column B. LINE and the ingest cron will use that URL.

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

Same as line ingest:

- `LINE_SYNC_API_KEY`
- `SUPABASE_SECRET_KEY` (required for Storage writes)
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLIC_KEY`
- Optional: `STORAGE_BUCKET` (default `images`), `STORAGE_FOLDER` (default `line-sync`)

Images are resized (max width 800) via the existing `imageProcessor` when possible.

## One-shot Drive catalog migration (local)

If the LINE「画像」sheet still has Drive URLs, and some (answered) topics already have Storage copies keyed by `source_image`, run:

```bash
# 1) Export sheet to input.csv; download Drive folder as Zip
# 2) Dry-run: DB classify + Zip filename match (0 uploads, 0 Google hits for matched rows)
node scripts/migrate_drive_catalog_images.mjs input.csv mapping.csv \
  --from-zip=/path/to/images.zip

# 3) Smoke-test 3 uploads from Zip
node scripts/migrate_drive_catalog_images.mjs input.csv mapping.csv \
  --from-zip=/path/to/images.zip --apply --limit=3

# 4) Full apply (+ rewrite source_image)
node scripts/migrate_drive_catalog_images.mjs input.csv mapping.csv \
  --from-zip=/path/to/images.zip --apply --update-source-image
```

Zip may be a single folder (`images/…`). Filenames match CSV `項番` / `ファイル名`; `LINE_ALBUM_…` names that mojibake in the Zip are matched via Python `zipfile` (Unicode) and trailing `_YYMMDD_N.ext` when needed.

Then replace「画像」B with `public_url` from `mapping.csv`. Unanswered images get Storage only (no new `topics` rows). Local run outputs belong under `scripts/local/` (gitignored). See script header for CSV column names.

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
  "usedUrlCount": 88,
  "usedTopicCount": 88,
  "unusedCount": 192,
  "folders": ["line-sync", "images"]
}
```

Server computes **Storage folders − image topics** (`topics` where `image` / `source_image` is set).  
Image topics are created only when LINE answers sync, so “in topics with an image” means already used — no `answers` join and no 1000-row trap on the answers table.

Default folders: `STORAGE_FOLDER` (`line-sync`) plus `STORAGE_EXTRA_FOLDERS` (default `images` for legacy imports).

LINE bot:

- Daily 「写真」 / image cron: random from spreadsheet「画像」only (no API).
- Monthly (or manual): `cronRebuildUnusedImageSheet` replaces「画像」with this API’s `urls` in one `setValues` batch. On API failure the sheet is left unchanged.

