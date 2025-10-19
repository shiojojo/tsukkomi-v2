import { FavoriteSchema } from '~/lib/schemas/favorite';
import { AnswerSchema } from '~/lib/schemas/answer';
import type { Answer } from '~/lib/schemas/answer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, supabaseAdmin, ensureConnection } from '../supabase';
import { DEFAULT_PAGE_SIZE } from '../constants';
import { withTiming } from './debug';

// Database row types for type safety
interface SearchViewRow {
  id: number;
  text: string;
  profile_id: string | null;
  topic_id: number | null;
  created_at: string;
  level1: number;
  level2: number;
  level3: number;
  comment_count: number;
}

async function getVotesByForAnswers(
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

/**
 * 概要: 指定プロフィールがお気に入り登録した回答一覧を取得する集約層。
 * Intent: /answers/favorites ルートから DB 依存を隠蔽し、topic/comment 等の派生取得の土台を提供する。
 * Contract:
 *   - Input: profileId は UUID 文字列必須。favorites テーブルの created_at 降順で Answer を返却。
 *   - Output: AnswerSchema[]（votes/votesBy/favorited を整形済み、favorited は常に true）。
 * Environment:
 *   - prod: Supabase favorites → answers → answer_vote_counts を参照し、片方向 join をクライアント側で整列。
 * Errors: Supabase エラー / zod 失敗はそのまま throw。profileId 未指定はエラー扱い。
 * SideEffects: なし（読み取り専用）。
 */
async function _getFavoriteAnswersForProfile(profileId: string, opts?: { page?: number; pageSize?: number }): Promise<{ answers: Answer[]; total: number }> {
  if (!profileId) {
    throw new Error('getFavoriteAnswersForProfile: profileId is required');
  }

  const { page = 1, pageSize = DEFAULT_PAGE_SIZE } = opts ?? {};
  await ensureConnection();
  const { data: favRows, error: favError, count } = await supabase
    .from('favorites')
    .select('answer_id, created_at', { count: 'exact' })
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (favError) throw favError;

  const orderedIds = (favRows ?? []).map((row: { answer_id: number }) => Number(row.answer_id)).filter(Number.isFinite);
  if (!orderedIds.length) return { answers: [], total: count ?? 0 };

  const idOrder = new Map<number, number>();
  orderedIds.forEach((id, index) => {
    if (!idOrder.has(id)) idOrder.set(id, index);
  });
  const uniqueIds = Array.from(idOrder.keys());

  // Use answer_search_view to get answers with comment_count
  const { data: answerRows, error: answerErr } = await supabase
    .from('answer_search_view')
    .select('id, text, profile_id, topic_id, created_at, level1, level2, level3, comment_count')
    .in('id', uniqueIds);
  if (answerErr) throw answerErr;

  const answers = (answerRows ?? []).map((a: SearchViewRow) => ({
    id: typeof a.id === 'string' ? Number(a.id) : a.id,
    text: a.text,
    profileId: a.profile_id ?? undefined,
    topicId: a.topic_id ?? undefined,
    created_at: a.created_at,
    commentCount: Number(a.comment_count ?? 0),
    level1: Number(a.level1 ?? 0),
    level2: Number(a.level2 ?? 0),
    level3: Number(a.level3 ?? 0),
  }));

  const votesByMap = await getVotesByForAnswers(uniqueIds);

  const normalized = answers
    .map((a) => ({
      ...a,
      votes: {
        level1: a.level1,
        level2: a.level2,
        level3: a.level3,
      },
      votesBy: votesByMap[a.id] ?? {},
      favorited: true,
    }))
    .sort((a, b) => {
      const ai = idOrder.get(a.id) ?? 0;
      const bi = idOrder.get(b.id) ?? 0;
      return ai - bi;
    });

  return { answers: AnswerSchema.array().parse(normalized as unknown), total: count ?? 0 };
}

export const getFavoriteAnswersForProfile = withTiming(_getFavoriteAnswersForProfile, 'getFavoriteAnswersForProfile', 'favorites');