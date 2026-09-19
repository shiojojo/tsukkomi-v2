# LINE Cron Answer Sync

This document describes how the Google Apps Script (GAS) bot syncs text-topic answers into the tsukkomi v2 database.

## API endpoint

- **Method:** `POST`
- **Path:** `/api/line-ingest`
- **Headers:**
  - `Content-Type: application/json`
  - `X-API-KEY: <shared secret>`

### Request body shape

```json
{
  "topic": {
    "kind": "text",
    "title": "お題テキスト",
    "createdAt": "2025-09-27T03:12:45.000Z",
    "sourceLabel": "回答シート"
  },
  "answers": [
    {
      "answerId": "A_mb0zkg_1e3f",
      "text": "回答本文",
      "lineUserId": "Uxxxxxxxx",
      "displayName": "HS",
      "groupId": "Cxxxxxxxx",
      "submittedAt": "2025-09-27T03:12:45.000Z"
    }
  ]
}
```

### Response

```json
{
  "ok": true,
  "result": {
    "topicId": 123,
    "inserted": 5,
    "skipped": 0,
    "createdTopic": false,
    "totalReceived": 5,
    "createdProfiles": 0,
    "updatedProfiles": 1
  }
}
```

- `inserted`: number of new answers written to the database.
- `skipped`: duplicate or invalid rows that were ignored.
- `createdTopic`: `true` if the topic row was newly inserted.

Failures return `ok: false` with a message, and the endpoint responds with an appropriate HTTP error code (4xx for validation/auth, 5xx for server-side failure).

## Server configuration (tsukkomi v2)

1. Generate a random shared secret (for example with `openssl rand -hex 32`).
2. Set the secret in the server environment as `LINE_SYNC_API_KEY`.
   - When deploying to Vercel, add the variable in the Environment Variables section (`LINE_SYNC_API_KEY=<your secret>`).
3. Deploy the new `/api/line-ingest` route.

## GAS configuration

Full trigger list lives in the **oogiriLineBot README**. Summary:

1. Script Properties:
   - `TSUKKOMI_API_ENDPOINT`: full URL of the ingest endpoint (e.g. `https://tsukkomi.example.com/api/line-ingest`).
   - `TSUKKOMI_API_KEY`: the shared secret (`LINE_SYNC_API_KEY` on the server).
   - `TSUKKOMI_GROUP_SHEET`: (optional) group timeline sheet name; falls back to `LINE_USERID`.

2. Time-driven triggers to schedule:
   - `cronSyncTextTopicsToTsukkomi` — every few minutes (answer sync)
   - `linePush` / `linePushImage` — when you want scheduled odai delivery
   - `cronRebuildUnusedImageSheet` — monthly (refresh「画像」from `/api/unused-image-urls`)

3. Do **not** schedule `getFileListInFolder` (deprecated Drive catalog).


## Sync behaviour

- **Text and image** topics are processed. If the current odai is an `http(s)` URL, the payload uses `topic.kind: "image"` with `sourceImage` set to that URL.
- The script reads the designated group sheet (typically the LINE group ID, e.g. `Cb27b7a04b848b9e42bdcd2b21ba3313c`) from the bottom, collecting rows whose topic column matches the current odai stored in `H2`. It slices out rows that were already synced by remembering the most recent `回答ID` in `TSUKKOMI_LAST_SYNC_ANSWER_ID`.
- Each answer requires non-empty `回答`(B列), `回答者ID`(C列), and `回答ID`(G列). Rows missing these fields are skipped.
- On the server, topic rows are created on demand (matching by title with `image IS NULL`). Profiles are looked up by `line_id`; new entries are created when necessary and their display names are updated when they change.
- Duplicate detection uses a `(profile_id, normalized text)` pair to keep the ingestion idempotent. Re-running the trigger with the same data is safe.

## Related

- Image upload / unused URLs: [image-upload.md](./image-upload.md)
- Image topics: `topic.kind: "image"` with `sourceImage` (public URL). Own Storage URLs are reused without re-upload.
- GAS triggers: `oogiriLineBot` README

