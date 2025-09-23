-- 002_rls_policies.sql
-- RLS policies for unified profiles schema

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- profiles: public read (names) / main creation by self / sub creation by parent
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS profiles_insert_main ON profiles;
CREATE POLICY profiles_insert_main ON profiles FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND parent_id IS NULL AND id = auth.uid()::uuid
);

DROP POLICY IF EXISTS profiles_insert_sub ON profiles;
CREATE POLICY profiles_insert_sub ON profiles FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND parent_id = auth.uid()::uuid
);

DROP POLICY IF EXISTS profiles_update ON profiles;
CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (id = auth.uid()::uuid OR parent_id = auth.uid()::uuid)
  WITH CHECK (id = auth.uid()::uuid OR parent_id = auth.uid()::uuid);

DROP POLICY IF EXISTS profiles_delete ON profiles;
CREATE POLICY profiles_delete ON profiles FOR DELETE USING (id = auth.uid()::uuid OR parent_id = auth.uid()::uuid);

-- topics: public read / auth create
DROP POLICY IF EXISTS topics_public_select ON topics;
CREATE POLICY topics_public_select ON topics FOR SELECT USING (true);

DROP POLICY IF EXISTS topics_insert_auth ON topics;
CREATE POLICY topics_insert_auth ON topics FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- answers: public read / writable if identity owned by user (self or child)
DROP POLICY IF EXISTS answers_public_select ON answers;
CREATE POLICY answers_public_select ON answers FOR SELECT USING (true);

DROP POLICY IF EXISTS answers_insert_identity ON answers;
CREATE POLICY answers_insert_identity ON answers FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    profile_id = auth.uid()::uuid OR
    profile_id IN (SELECT id FROM profiles WHERE parent_id = auth.uid()::uuid)
  )
);

DROP POLICY IF EXISTS answers_update_identity ON answers;
CREATE POLICY answers_update_identity ON answers FOR UPDATE
  USING (
  profile_id = auth.uid()::uuid OR
  profile_id IN (SELECT id FROM profiles WHERE parent_id = auth.uid()::uuid)
  )
  WITH CHECK (
  profile_id = auth.uid()::uuid OR
  profile_id IN (SELECT id FROM profiles WHERE parent_id = auth.uid()::uuid)
  );

DROP POLICY IF EXISTS answers_delete_identity ON answers;
CREATE POLICY answers_delete_identity ON answers FOR DELETE USING (
  profile_id = auth.uid()::uuid OR
  profile_id IN (SELECT id FROM profiles WHERE parent_id = auth.uid()::uuid)
);

-- comments
DROP POLICY IF EXISTS comments_public_select ON comments;
CREATE POLICY comments_public_select ON comments FOR SELECT USING (true);

DROP POLICY IF EXISTS comments_insert_identity ON comments;
CREATE POLICY comments_insert_identity ON comments FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    profile_id = auth.uid()::uuid OR
    profile_id IN (SELECT id FROM profiles WHERE parent_id = auth.uid()::uuid)
  )
);

DROP POLICY IF EXISTS comments_update_identity ON comments;
CREATE POLICY comments_update_identity ON comments FOR UPDATE
  USING (
  profile_id = auth.uid()::uuid OR
  profile_id IN (SELECT id FROM profiles WHERE parent_id = auth.uid()::uuid)
  )
  WITH CHECK (
  profile_id = auth.uid()::uuid OR
  profile_id IN (SELECT id FROM profiles WHERE parent_id = auth.uid()::uuid)
  );

DROP POLICY IF EXISTS comments_delete_identity ON comments;
CREATE POLICY comments_delete_identity ON comments FOR DELETE USING (
  profile_id = auth.uid()::uuid OR
  profile_id IN (SELECT id FROM profiles WHERE parent_id = auth.uid()::uuid)
);

-- votes
DROP POLICY IF EXISTS votes_public_select ON votes;
CREATE POLICY votes_public_select ON votes FOR SELECT USING (true);

DROP POLICY IF EXISTS votes_insert_identity ON votes;
CREATE POLICY votes_insert_identity ON votes FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    profile_id = auth.uid()::uuid OR
    profile_id IN (SELECT id FROM profiles WHERE parent_id = auth.uid()::uuid)
  )
);

DROP POLICY IF EXISTS votes_update_identity ON votes;
CREATE POLICY votes_update_identity ON votes FOR UPDATE
  USING (
  profile_id = auth.uid()::uuid OR
  profile_id IN (SELECT id FROM profiles WHERE parent_id = auth.uid()::uuid)
  )
  WITH CHECK (
  profile_id = auth.uid()::uuid OR
  profile_id IN (SELECT id FROM profiles WHERE parent_id = auth.uid()::uuid)
  );

DROP POLICY IF EXISTS votes_delete_identity ON votes;
CREATE POLICY votes_delete_identity ON votes FOR DELETE USING (
  profile_id = auth.uid()::uuid OR
  profile_id IN (SELECT id FROM profiles WHERE parent_id = auth.uid()::uuid)
);

-- favorites RLS (aligns with votes policies)
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS favorites_public_select ON favorites;
CREATE POLICY favorites_public_select ON favorites FOR SELECT USING (true);

DROP POLICY IF EXISTS favorites_insert_identity ON favorites;
CREATE POLICY favorites_insert_identity ON favorites FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    profile_id = auth.uid()::uuid OR
    profile_id IN (SELECT id FROM profiles WHERE parent_id = auth.uid()::uuid)
  )
);

DROP POLICY IF EXISTS favorites_delete_identity ON favorites;
CREATE POLICY favorites_delete_identity ON favorites FOR DELETE USING (
  profile_id = auth.uid()::uuid OR
  profile_id IN (SELECT id FROM profiles WHERE parent_id = auth.uid()::uuid)
);
