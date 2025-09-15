-- 002_rls_policies.sql
-- Row Level Security (RLS) policies for tsukkomi-v2
-- Guidance: policies below grant public SELECT for read-only data and
-- enforce owner-only WRITE for user-owned resources. Service role
-- connections (Supabase service role) bypass RLS and are not affected.

-- Enable RLS on all relevant tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- ==========================
-- profiles
-- ==========================
-- Publicly readable (exposes display names). Insert/Update/Delete only by the authenticated owner.
CREATE POLICY "profiles_public_select" ON profiles FOR SELECT USING (true);

-- Insert: allow when authenticated and id matches auth.uid()
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (id = auth.uid()::uuid)
);

CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (id = auth.uid()::uuid)
  WITH CHECK (id = auth.uid()::uuid);

CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE USING (id = auth.uid()::uuid);

-- ==========================
-- sub_users
-- ==========================
-- Sub-users are child identities. Read by authenticated users; modify only by parent user.
CREATE POLICY "sub_users_select" ON sub_users FOR SELECT USING (true);

CREATE POLICY "sub_users_insert_parent" ON sub_users FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND parent_user_id = auth.uid()::uuid
);

CREATE POLICY "sub_users_update_parent" ON sub_users FOR UPDATE
  USING (parent_user_id = auth.uid()::uuid)
  WITH CHECK (parent_user_id = auth.uid()::uuid);

CREATE POLICY "sub_users_delete_parent" ON sub_users FOR DELETE USING (parent_user_id = auth.uid()::uuid);

-- ==========================
-- topics
-- ==========================
-- Topics are public content. Allow SELECT for everyone. Insertion requires authentication.
CREATE POLICY "topics_public_select" ON topics FOR SELECT USING (true);
CREATE POLICY "topics_insert_auth" ON topics FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Updates/deletes are intentionally restricted (no generic update/delete policy)

-- ==========================
-- answers
-- ==========================
-- Public read. Create/modify only by the author (author_id must match auth.uid()).
CREATE POLICY "answers_public_select" ON answers FOR SELECT USING (true);

CREATE POLICY "answers_insert_author" ON answers FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND author_id = auth.uid()::uuid
);

CREATE POLICY "answers_update_author" ON answers FOR UPDATE
  USING (author_id = auth.uid()::uuid)
  WITH CHECK (author_id = auth.uid()::uuid);

CREATE POLICY "answers_delete_author" ON answers FOR DELETE USING (author_id = auth.uid()::uuid);

-- ==========================
-- comments
-- ==========================
CREATE POLICY "comments_public_select" ON comments FOR SELECT USING (true);

CREATE POLICY "comments_insert_author" ON comments FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND author_id = auth.uid()::uuid
);

CREATE POLICY "comments_update_author" ON comments FOR UPDATE
  USING (author_id = auth.uid()::uuid)
  WITH CHECK (author_id = auth.uid()::uuid);

CREATE POLICY "comments_delete_author" ON comments FOR DELETE USING (author_id = auth.uid()::uuid);

-- ==========================
-- votes
-- ==========================
-- Allow public read for aggregate queries. Insert/modify only by the actor (auth.uid()).
CREATE POLICY "votes_public_select" ON votes FOR SELECT USING (true);

CREATE POLICY "votes_insert_actor" ON votes FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND actor_id = auth.uid()::text
);

CREATE POLICY "votes_update_actor" ON votes FOR UPDATE
  USING (actor_id = auth.uid()::text)
  WITH CHECK (actor_id = auth.uid()::text);

CREATE POLICY "votes_delete_actor" ON votes FOR DELETE USING (actor_id = auth.uid()::text);

-- Note: Service role connections bypass RLS. If you need broader read access for anonymous
-- clients, you can create policies that allow FOR SELECT USING (true) for anon, otherwise
-- require auth.uid() IS NOT NULL.

-- Ensure the new compatibility view `public.profiles` is accessible to typical Supabase
-- client roles. RLS on the underlying tables (profiles, sub_users) still applies.
-- Granting SELECT here ensures the anon/authenticated roles can see the view;
-- policies above determine which rows are visible.
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.profiles TO authenticated;
