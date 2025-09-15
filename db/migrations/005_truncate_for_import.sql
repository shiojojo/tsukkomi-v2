-- 005_truncate_for_import.sql
-- Dev helper: truncate import-related tables and restart identities to allow re-importing
-- WARNING: This is destructive. Run only in development or when you intentionally want to remove existing data.

BEGIN;

-- Truncate dependent tables first and restart their sequences.
-- This will remove all rows from answers, comments, votes and topics and reset their serial counters.
-- Truncate all application tables (including profiles/sub_users) and reset identities.
-- CAUTION: This removes ALL data for these tables.
-- Note: some Postgres versions do not support IF EXISTS with TRUNCATE; omit it to avoid syntax errors.
TRUNCATE TABLE profiles, sub_users, answers, comments, votes, topics RESTART IDENTITY CASCADE;

COMMIT;

-- Optional: If you also want to remove profiles created by a previous import, you can run:
-- DELETE FROM profiles WHERE line_id IS NOT NULL;
