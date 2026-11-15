-- Keep public profile names and IDs readable, but keep the LINE platform ID
-- private. LINE ingestion uses the service_role client and is not affected.
REVOKE SELECT ON TABLE public.profiles FROM anon, authenticated;
REVOKE SELECT (line_id) ON TABLE public.profiles FROM anon, authenticated;

GRANT SELECT (id, parent_id, name, created_at)
  ON TABLE public.profiles
  TO anon, authenticated;