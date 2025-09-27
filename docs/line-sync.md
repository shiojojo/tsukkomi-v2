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

1. In the Apps Script project, add the following Script Properties:
   - `TSUKKOMI_API_ENDPOINT`: full URL of the ingest endpoint (e.g. `https://tsukkomi.example.com/api/line-ingest`).
   - `TSUKKOMI_API_KEY`: the shared secret configured on the server.
2. Ensure the new global function `syncLatestTextTopicAnswersToTsukkomi` is scheduled via a time-driven trigger. The recommended cadence is every 5 minutes.
3. Optional: set global variables `TSUKKOMI_API_ENDPOINT` and `TSUKKOMI_API_KEY` instead of script properties if preferred.

## Sync behaviour

- Only **text** topics are processed. Rows whose topic field starts with `http://` or `https://` are ignored (image topics will be handled later).
- The script reads the `回答` sheet from the bottom, collecting rows that share the same topic value as the latest row. It slices out rows that were already synced by remembering the most recent `回答ID` in `TSUKKOMI_LAST_SYNC_ANSWER_ID`.
- Each answer requires non-empty `回答`(B列), `回答者ID`(C列), and `回答ID`(G列). Rows missing these fields are skipped.
- On the server, topic rows are created on demand (matching by title with `image IS NULL`). Profiles are looked up by `line_id`; new entries are created when necessary and their display names are updated when they change.
- Duplicate detection uses a `(profile_id, normalized text)` pair to keep the ingestion idempotent. Re-running the trigger with the same data is safe.

## Future work

- Extend the payload to support image topics (requires uploading images and storing `source_image`).
- Add automated tests for the ingestion pathway once the Vitest suite is introduced.
