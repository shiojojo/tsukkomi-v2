-- 003_migrate_sub_users.sql
-- Migrate embedded `sub_users` JSON from `profiles` into a separate `sub_users` table.
-- Idempotent: safe to run multiple times.
-- この手順は不要かもしれません

BEGIN;

-- Ensure sub_users table exists (schema defined as in 001_create_schema.sql)
CREATE TABLE IF NOT EXISTS sub_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  line_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- If profiles.sub_users column exists (legacy), extract rows and insert into sub_users.
DO $$
DECLARE
  col_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'sub_users'
  ) INTO col_exists;

  IF col_exists THEN
    -- Insert sub_users from JSON array in profiles.sub_users into sub_users table.
    -- Avoid duplicates by checking for existing (parent_user_id, name, line_id).
    INSERT INTO sub_users (id, parent_user_id, name, line_id, created_at)
    SELECT
      gen_random_uuid() as id,
      p.id as parent_user_id,
      (elem ->> 'name') as name,
      (elem ->> 'line_id') as line_id,
      now() as created_at
    FROM profiles p,
    LATERAL (
      CASE
        WHEN p.sub_users IS NULL THEN '[]'::jsonb
        WHEN jsonb_typeof(p.sub_users::jsonb) = 'array' THEN p.sub_users::jsonb
        ELSE ('[' || p.sub_users::text || ']')::jsonb
      END
    ) as arr(elements),
    LATERAL jsonb_array_elements(arr.elements) as elem
    WHERE NOT EXISTS (
      SELECT 1 FROM sub_users su
      WHERE su.parent_user_id = p.id
        AND su.name = (elem ->> 'name')
        AND (COALESCE(su.line_id, '') = COALESCE((elem ->> 'line_id'), ''))
    );

    -- Drop the legacy column now that data is migrated
    ALTER TABLE profiles DROP COLUMN IF EXISTS sub_users;
  END IF;
END$$;

COMMIT;
