import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, ensureConnection } from '../supabase';
import { getFavoritesForProfile } from './favorites';

/**
 * Get user's profile data including votes and favorites for answers
 * This ensures the latest data is always fetched from DB
 */
export async function getProfileAnswerData(profileId: string, answerIds: Array<number | string>) {
  const [votes, favorites] = await Promise.all([
    (async () => {
      await ensureConnection();
      let q = supabase.from('votes').select('answer_id, level');
      q = q.eq('profile_id', profileId);
      if (answerIds && answerIds.length) q = q.in('answer_id', answerIds.map((v) => Number(v)).filter(Boolean));
      const { data, error } = await q;
      if (error) throw error;

      const result: Record<number, number> = {};
      for (const vote of (data ?? [])) {
        result[Number(vote.answer_id)] = vote.level;
      }
      return result;
    })(),
    getFavoritesForProfile(profileId, answerIds)
  ]);

  return {
    votes,
    favorites: new Set(favorites)
  };
}

export async function getVotesByForAnswers(
  answerIds: Array<number | string>,
  client: SupabaseClient = supabase
): Promise<Record<number, Record<string, number>>> {
  const numericIds = Array.from(
    new Set(
      (answerIds ?? [])
        .map((id) => Number(id))
        .filter((id): id is number => Number.isFinite(id))
    )
  );
  if (!numericIds.length || !client) return {};

  const { data, error } = await client
    .from('votes')
    .select('answer_id, profile_id, level')
    .in('answer_id', numericIds);
  if (error) throw error;

  const map: Record<number, Record<string, number>> = {};
  for (const row of data ?? []) {
    const answerId = Number(row.answer_id);
    const profileId = row.profile_id;
    const level = Number(row.level);
    if (!profileId || !Number.isFinite(answerId) || ![1, 2, 3].includes(level)) {
      continue;
    }
    map[answerId] = map[answerId] ?? {};
    map[answerId][String(profileId)] = level;
  }
  return map;
}