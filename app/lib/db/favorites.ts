import { FavoriteSchema } from '~/lib/schemas/favorite';
import { supabase, supabaseAdmin, ensureConnection } from '../supabase';
import { withTiming } from './debug';

async function _addFavorite(input: { answerId: number | string; profileId: string }) {
  const parsed = FavoriteSchema.parse({ answerId: input.answerId, profileId: input.profileId });
  const answerId = Number(parsed.answerId);
  const profileId = parsed.profileId;
  await ensureConnection();
  const writeClient = supabaseAdmin ?? supabase;
  if (!writeClient) throw new Error('No Supabase client available for writes');
  // Insert if not exists: use upsert-like behavior by ignoring duplicate key error
  const { error } = await writeClient
    .from('favorites')
    .insert({ answer_id: answerId, profile_id: profileId });
  if (error) {
    // ignore unique constraint violation (already favorited)
    const msg = String(error?.message ?? '');
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return { success: true } as const;
    }
    throw error;
  }
  return { success: true } as const;
}

export const addFavorite = withTiming(_addFavorite, 'addFavorite', 'favorites');

async function _removeFavorite(input: { answerId: number | string; profileId: string }) {
  const parsed = FavoriteSchema.parse({ answerId: input.answerId, profileId: input.profileId });
  const answerId = Number(parsed.answerId);
  const profileId = parsed.profileId;
  await ensureConnection();
  const writeClient = supabaseAdmin ?? supabase;
  if (!writeClient) throw new Error('No Supabase client available for writes');
  const { error } = await writeClient
    .from('favorites')
    .delete()
    .eq('answer_id', answerId)
    .eq('profile_id', profileId);
  if (error) throw error;
  return { success: true } as const;
}

export const removeFavorite = withTiming(_removeFavorite, 'removeFavorite', 'favorites');

async function _toggleFavorite(input: { answerId: number | string; profileId: string }) {
  const parsed = FavoriteSchema.parse({ answerId: input.answerId, profileId: input.profileId });
  const answerId = Number(parsed.answerId);
  const profileId = parsed.profileId;
  await ensureConnection();
  const { data: existing, error: selErr } = await supabase
    .from('favorites')
    .select('id')
    .eq('answer_id', answerId)
    .eq('profile_id', profileId)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing && existing.id) {
    await removeFavorite({ answerId, profileId });
    return { favorited: false } as const;
  }
  await addFavorite({ answerId, profileId });
  return { favorited: true } as const;
}

export const toggleFavorite = withTiming(_toggleFavorite, 'toggleFavorite', 'favorites');

async function _getFavoritesForProfile(profileId: string, answerIds?: Array<number | string>) {
  await ensureConnection();
  let q = supabase.from('favorites').select('answer_id');
  q = q.eq('profile_id', profileId);
  if (answerIds && answerIds.length) q = q.in('answer_id', answerIds.map((v) => Number(v)).filter(Boolean));
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r: { answer_id: number }) => Number(r.answer_id));
}

export const getFavoritesForProfile = withTiming(_getFavoritesForProfile, 'getFavoritesForProfile', 'favorites');