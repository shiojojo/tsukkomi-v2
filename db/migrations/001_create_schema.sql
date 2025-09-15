-- 001_create_schema.sql
-- Initial schema for tsukkomi-v2 (profiles-based)

-- Enable helpful extensions used by migrations
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Profiles: use uuid primary key. Use gen_random_uuid() as default for server-side generation.
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  line_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Sub-users: lightweight identities that can act on behalf of a parent profile
CREATE TABLE IF NOT EXISTS sub_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  line_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Topics: integer PK (bigserial) because app mock uses numeric ids
CREATE TABLE IF NOT EXISTS topics (
  id bigserial PRIMARY KEY,
  title text NOT NULL,
  image text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS topics_created_at_idx ON topics (created_at DESC);

-- Answers: main content records; topic_id optional per current code
CREATE TABLE IF NOT EXISTS answers (
  id bigserial PRIMARY KEY,
  text text NOT NULL,
  author_name text,
  author_id uuid REFERENCES profiles(id),
  topic_id bigint REFERENCES topics(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS answers_topic_idx ON answers (topic_id);
CREATE INDEX IF NOT EXISTS answers_created_at_idx ON answers (created_at DESC);
CREATE INDEX IF NOT EXISTS answers_text_trgm_idx ON answers USING gin (text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS answers_author_name_trgm_idx ON answers USING gin (author_name gin_trgm_ops);

-- Comments linked to answers. App orders by created_at ASC.
CREATE TABLE IF NOT EXISTS comments (
  id bigserial PRIMARY KEY,
  answer_id bigint NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
  text text NOT NULL,
  author_name text,
  author_id uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comments_answer_created_at_idx ON comments (answer_id, created_at);

-- Votes: one actor (user or sub_user) can vote once per answer at level 1/2/3
CREATE TABLE IF NOT EXISTS votes (
  id bigserial PRIMARY KEY,
  answer_id bigint NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  level smallint NOT NULL CHECK (level IN (1,2,3)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (answer_id, actor_id)
);
CREATE INDEX IF NOT EXISTS votes_answer_idx ON votes (answer_id);
CREATE INDEX IF NOT EXISTS votes_actor_idx ON votes (actor_id);
CREATE INDEX IF NOT EXISTS votes_answer_level_idx ON votes (answer_id, level);

-- Read-friendly view that aggregates vote counts per answer.
CREATE OR REPLACE VIEW answer_vote_counts AS
SELECT
  answer_id,
  COALESCE(SUM(CASE WHEN level = 1 THEN 1 ELSE 0 END), 0) AS level1,
  COALESCE(SUM(CASE WHEN level = 2 THEN 1 ELSE 0 END), 0) AS level2,
  COALESCE(SUM(CASE WHEN level = 3 THEN 1 ELSE 0 END), 0) AS level3
FROM votes
GROUP BY answer_id;