-- 005_truncate_for_import.sql
-- Dev helper: truncate application tables for a fresh import.
-- WARNING: Destructive. Run only in development or when you intentionally want a full reset.

BEGIN;

-- Order doesn't matter with CASCADE, but list explicit tables for clarity.
TRUNCATE TABLE votes, comments, answers, topics, profiles RESTART IDENTITY CASCADE;

COMMIT;

-- Optional targeted cleanup examples:
-- DELETE FROM profiles WHERE line_id IS NOT NULL;
