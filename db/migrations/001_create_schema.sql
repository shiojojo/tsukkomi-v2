-- 001_create_schema.sql
-- Unified profiles table (main + sub profiles in one)
-- Rationale: simplify FK / RLS, allow main or sub identity selection for answers/comments/votes.

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- profiles: parent_id NULL = main profile. child rows reference a main profile.
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  line_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX IF NOT EXISTS profiles_parent_idx ON profiles(parent_id);
-- root_id: main identity for this row (itself if parent_id NULL)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS root_id uuid GENERATED ALWAYS AS (COALESCE(parent_id, id)) STORED;
CREATE INDEX IF NOT EXISTS profiles_root_idx ON profiles(root_id);

-- topics
CREATE TABLE IF NOT EXISTS topics (
  id bigserial PRIMARY KEY,
  title text NOT NULL,
  image text,
  source_image text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS topics_created_at_idx ON topics (created_at DESC);

-- answers
CREATE TABLE IF NOT EXISTS answers (
  id bigserial PRIMARY KEY,
  topic_id bigint REFERENCES topics(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES profiles(id),
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS answers_topic_idx ON answers (topic_id);
CREATE INDEX IF NOT EXISTS answers_created_at_idx ON answers (created_at DESC);
CREATE INDEX IF NOT EXISTS answers_text_trgm_idx ON answers USING gin (text gin_trgm_ops);

-- comments
CREATE TABLE IF NOT EXISTS comments (
  id bigserial PRIMARY KEY,
  answer_id bigint NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id),
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comments_answer_created_at_idx ON comments (answer_id, created_at);

-- votes (one per identity per answer)
CREATE TABLE IF NOT EXISTS votes (
  id bigserial PRIMARY KEY,
  answer_id bigint NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  level smallint NOT NULL CHECK (level IN (1,2,3)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (answer_id, profile_id)
);
CREATE INDEX IF NOT EXISTS votes_answer_idx ON votes (answer_id);
CREATE INDEX IF NOT EXISTS votes_profile_idx ON votes (profile_id);
CREATE INDEX IF NOT EXISTS votes_answer_level_idx ON votes (answer_id, level);

-- favorites (per-profile favorites for answers)
CREATE TABLE IF NOT EXISTS favorites (
  id bigserial PRIMARY KEY,
  answer_id bigint NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (answer_id, profile_id)
);
CREATE INDEX IF NOT EXISTS favorites_answer_idx ON favorites (answer_id);
CREATE INDEX IF NOT EXISTS favorites_profile_idx ON favorites (profile_id);

-- vote counts view
create view public.answer_vote_counts with (security_invoker = on) as
 SELECT answer_id,
    count(*) FILTER (WHERE level = 1) AS level1,
    count(*) FILTER (WHERE level = 2) AS level2,
    count(*) FILTER (WHERE level = 3) AS level3
   FROM votes
  GROUP BY answer_id;
