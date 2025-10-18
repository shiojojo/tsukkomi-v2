import { UserSchema } from '~/lib/schemas/user';
import type { User, SubUser } from '~/lib/schemas/user';
import { IdentitySchema } from '~/lib/schemas/identity';
import type { Identity } from '~/lib/schemas/identity';
import { supabase, supabaseAdmin, ensureConnection } from '../supabase';
import { withTiming } from './debug';

// Database row types
interface DatabaseProfileRow {
  id: number;
  parent_id: number | null;
  name: string;
  line_id: string | null;
  created_at: string;
}

interface DatabaseSubProfileRow {
  id: number;
  parent_id: number | null;
  name: string;
  line_id: string | null;
}

async function _getUsers(opts?: { limit?: number; onlyMain?: boolean }): Promise<User[]> {
  // fetch profiles and attach sub_users
  // If opts.limit is provided, only fetch up to that many profiles and then fetch
  // sub-users for the returned main users. This avoids scanning the full profiles
  // table on pages that don't need the entire list (e.g. /answers loader).
  const limit = opts?.limit;
  if (limit && limit <= 0) return [];

  if (!limit) {
    // original full-fetch behavior
    const { data, error } = await supabase.from('profiles').select('id, parent_id, name, line_id, created_at');
    if (error) throw error;
    const identitiesTmp = (data ?? []).map((r: DatabaseProfileRow) => IdentitySchema.parse({ id: String(r.id), parentId: r.parent_id ? String(r.parent_id) : null, name: r.name, line_id: r.line_id ?? undefined, created_at: r.created_at }));
    const mains = identitiesTmp.filter(i => i.parentId == null);
    const rows = mains.map(m => ({ id: m.id, name: m.name, line_id: m.line_id, subUsers: identitiesTmp.filter(c => c.parentId === m.id).map(c => ({ id: c.id, name: c.name, line_id: c.line_id })) }));
    return UserSchema.array().parse(rows as unknown);
  }

  // limited fetch: get first `limit` profiles (may include mains and subs), then
  // determine mains and fetch their sub-users explicitly.
  const { data: dataLimited, error: errLimited } = await supabase
    .from('profiles')
    .select('id, parent_id, name, line_id, created_at')
    .order('created_at', { ascending: false })
    .range(0, limit - 1);
  if (errLimited) throw errLimited;
  const fetched = (dataLimited ?? []).map((r: DatabaseProfileRow) => IdentitySchema.parse({ id: String(r.id), parentId: r.parent_id ? String(r.parent_id) : null, name: r.name, line_id: r.line_id ?? undefined, created_at: r.created_at }));

  const mains = fetched.filter(i => i.parentId == null);
  const mainIds = mains.map(m => m.id).filter(Boolean);

  // fetch sub-users belonging to these mains (if any)
  let subs: Identity[] = [];
  if (mainIds.length) {
    const { data: subData, error: subErr } = await supabase
      .from('profiles')
      .select('id, parent_id, name, line_id')
      .in('parent_id', mainIds);
    if (subErr) throw subErr;
    subs = (subData ?? []).map((r: DatabaseSubProfileRow) => IdentitySchema.parse({ id: String(r.id), parentId: r.parent_id ? String(r.parent_id) : null, name: r.name, line_id: r.line_id ?? undefined }));
  }

  const rows = mains.map(m => ({
    id: m.id,
    name: m.name,
    line_id: m.line_id,
    subUsers: subs.filter((c: Identity) => c.parentId === m.id).map((c: Identity) => ({ id: c.id, name: c.name, line_id: c.line_id })),
  }));

  return UserSchema.array().parse(rows as unknown);
}

export const getUsers = withTiming(_getUsers, 'getUsers', 'users');

/**
 * addSubUser
 * Intent: create a new sub-user in dev and return it
 * Contract: name validated elsewhere. id is generated to be unique within mockUsers.
 */
async function _addSubUser(input: { parentId: string; name: string }): Promise<SubUser> {
  await ensureConnection();
  await ensureConnection();
  const writeClient = supabaseAdmin ?? supabase;
  if (!supabaseAdmin && !writeClient) throw new Error('No Supabase client available for writes');
  const { data, error } = await writeClient
  .from('profiles')
  .insert({ parent_id: input.parentId, name: input.name })
    .select('*')
    .single();
  if (error) throw error;
  return data as SubUser;
}

export const addSubUser = withTiming(_addSubUser, 'addSubUser', 'users');

/**
 * removeSubUser
 * Intent: delete a sub-user from parent in dev and return boolean
 */
async function _removeSubUser(input: { id: string }): Promise<void> {
  await ensureConnection();
  const writeClient = supabaseAdmin ?? supabase;
  if (!supabaseAdmin && !writeClient) throw new Error('No Supabase client available for writes');
  const { error } = await writeClient
    .from('profiles')
    .delete()
    .eq('id', input.id);
  if (error) throw error;
}

export const removeSubUser = withTiming(_removeSubUser, 'removeSubUser', 'users');