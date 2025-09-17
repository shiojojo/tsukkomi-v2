-- 006_add_topics_created_at_index.sql
-- Ensure an index exists to speed up ORDER BY created_at on topics
-- Idempotent: uses IF NOT EXISTS so it can be applied safely multiple times.

-- Note: for very large tables prefer creating the index CONCURRENTLY to avoid locks.
-- Example (run manually in production if desired):
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS topics_created_at_idx ON topics (created_at DESC);

BEGIN;

CREATE INDEX IF NOT EXISTS topics_created_at_idx ON topics (created_at DESC);

COMMIT;
