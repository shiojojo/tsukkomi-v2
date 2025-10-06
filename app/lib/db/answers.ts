import type { SupabaseClient } from '@supabase/supabase-js';
import { AnswerSchema } from '~/lib/schemas/answer';
import type { Answer } from '~/lib/schemas/answer';
import { supabase, supabaseAdmin, ensureConnection } from '../supabase';
import { getFavoritesForProfile } from './favorites';

// Note: in-memory caching and edge-config have been removed to always query
// the database directly for freshest results and to avoid cache wait delays.
// keep a no-op invalidation function so existing mutation code can call it
// without conditional edits. This intentionally does nothing now.
function invalidateCache(_prefix: string) {
  // no-op: caching removed
}

async function getVotesByForAnswers(
  answerIds: Array<number | string>,
  client: SupabaseClient | null = supabase
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

export async function getAnswers(): Promise<Answer[]> {
  // always fetch fresh answers from DB
  try {
    await ensureConnection();
  } catch (error) {
    console.error('Supabase connection failed in getAnswers:', error);
    return []; // Return empty array on connection failure
  }
  const { data: answerRows, error: answerErr } = await supabase
    .from('answers')
    .select('id, text, profile_id, topic_id, created_at')
    .order('created_at', { ascending: false });
  if (answerErr) throw answerErr;

  const answers = (answerRows ?? []).map((a: any) => ({
    id: typeof a.id === 'string' ? Number(a.id) : a.id,
    text: a.text,
  profileId: a.profile_id ?? undefined,
    topicId: a.topic_id ?? undefined,
    created_at: a.created_at ?? a.createdAt,
  }));

  // collect ids and fetch aggregated counts using the view
  const ids = answers.map((r: any) => Number(r.id)).filter(Boolean);
  const countsMap: Record<number, { level1: number; level2: number; level3: number }> = {};
  if (ids.length) {
    const { data: countsData, error: countsErr } = await supabase
      .from('answer_vote_counts')
      .select('answer_id, level1, level2, level3')
      .in('answer_id', ids);
    if (countsErr) throw countsErr;
    for (const c of countsData ?? []) {
      countsMap[Number(c.answer_id)] = {
        level1: Number(c.level1 ?? 0),
        level2: Number(c.level2 ?? 0),
        level3: Number(c.level3 ?? 0),
      };
    }
  }

  const votesByMap = await getVotesByForAnswers(ids);

  const normalized = answers.map((a: any) => ({
    ...a,
    votes: countsMap[a.id] ?? { level1: 0, level2: 0, level3: 0 },
    votesBy: votesByMap[a.id] ?? {},
  }));

  return AnswerSchema.array().parse(normalized as any);
}

/**
 * getUserAnswerData
 * Intent: Retrieve user's votes and favorites for specific answers.
 * Contract: Returns { votes: Record<number, number>, favorites: Set<number> }
 * Environment: Always uses Supabase.
 * Errors: Throws on DB errors.
 */
export async function getUserAnswerData(profileId: string, answerIds: number[]): Promise<{ votes: Record<number, number>; favorites: Set<number> }> {
  if (!profileId || !answerIds.length) {
    return { votes: {}, favorites: new Set() };
  }

  await ensureConnection();

  // Get user's votes for these answers
  const { data: voteData, error: voteErr } = await supabase
    .from('votes')
    .select('answer_id, level')
    .eq('profile_id', profileId)
    .in('answer_id', answerIds);

  if (voteErr) throw voteErr;

  const userVotes: Record<number, number> = {};
  if (voteData) {
    for (const vote of voteData) {
      userVotes[Number(vote.answer_id)] = vote.level;
    }
  }

  // Get user's favorites for these answers
  const userFavs = await getFavoritesForProfile(profileId, answerIds);
  const userFavorites = new Set<number>(userFavs);

  return { votes: userVotes, favorites: userFavorites };
}

/**
 * searchAnswers
 * Server-side paginated search using a materialized view for efficient filtering and sorting.
 * Supports filters on author, topic title, dates, score, and comments.
 * Returns { answers, total } where total is the total matching count.
 */
export async function searchAnswers(opts: {
  q?: string;
  author?: string;
  topicId?: string | number;
  page?: number;
  pageSize?: number;
  sortBy?: 'newest' | 'oldest' | 'scoreDesc';
  minScore?: number | undefined;
  hasComments?: boolean;
  fromDate?: string | undefined;
  toDate?: string | undefined;
}): Promise<{ answers: Answer[]; total: number }> {
  const { q, author, topicId, page = 1, pageSize = 20, sortBy = 'newest', minScore, hasComments, fromDate, toDate } = opts;
  await ensureConnection();
  if (!supabaseAdmin) {
    throw new Error('Admin client required for search operations');
  }

  let baseQuery = supabaseAdmin
    .from('answer_search_view')
    .select('*', { count: 'exact' });

  if (topicId != null) baseQuery = baseQuery.eq('topic_id', Number(topicId));

  if (author) {
    const nameToMatch = String(author).trim();
    baseQuery = baseQuery.ilike('author_name', `%${nameToMatch}%`);
  }

  if (q) {
    const nameToMatch = String(q).trim();
    baseQuery = baseQuery.ilike('topic_title', `%${nameToMatch}%`);
  }

  if (fromDate) {
    baseQuery = baseQuery.gte('created_at', fromDate.includes('T') ? fromDate : `${fromDate}T00:00:00.000Z`);
  }

  if (toDate) {
    if (!toDate.includes('T')) {
      const d = new Date(toDate + 'T00:00:00.000Z');
      const next = new Date(d.getTime() + 24 * 60 * 60 * 1000);
      baseQuery = baseQuery.lt('created_at', next.toISOString());
    } else {
      baseQuery = baseQuery.lte('created_at', toDate);
    }
  }

  if (minScore != null) baseQuery = baseQuery.gte('score', minScore);

  if (hasComments) baseQuery = baseQuery.eq('has_comments', true);

  if (sortBy === 'scoreDesc') baseQuery = baseQuery.order('score', { ascending: false });
  else if (sortBy === 'oldest') baseQuery = baseQuery.order('created_at', { ascending: true });
  else baseQuery = baseQuery.order('created_at', { ascending: false });

  const offset = (page - 1) * pageSize;
  const { data, error, count: c } = await baseQuery.range(offset, offset + pageSize - 1);
  if (error) throw error;

  const answers = (data ?? []).map((a: any) => ({
    id: a.id,
    text: a.text,
    profileId: a.profile_id,
    topicId: a.topic_id,
    created_at: a.created_at,
    votes: { level1: a.level1, level2: a.level2, level3: a.level3 },
  }));

  const ids = answers.map((a) => Number(a.id)).filter(Number.isFinite);
  const votesByMap = ids.length
    ? await getVotesByForAnswers(ids, supabaseAdmin ?? supabase)
    : {};

  const normalized = answers.map((a) => ({
    ...a,
    votesBy: votesByMap[Number(a.id)] ?? {},
  }));

  return { answers: AnswerSchema.array().parse(normalized), total: c ?? 0 };
}

export async function getAnswersByTopic(topicId: string | number, profileId?: string) {
  try {
    await ensureConnection();
  } catch (e) {
    // If connection fails, return empty answers to avoid hanging loaders.
    // eslint-disable-next-line no-console
    console.error('getAnswersByTopic: ensureConnection failed, returning empty list', e);
    return [];
  }
  const numericTopic = Number(topicId);
  let query = supabase
    .from('answers')
    .select('id, text, profile_id, topic_id, created_at')
    .eq('topic_id', numericTopic)
    .order('created_at', { ascending: false });
  if (profileId) {
    query = query.eq('profile_id', profileId);
  }
  const { data: answerRows, error: answerErr } = await query;
  if (answerErr) throw answerErr;

  const answers = (answerRows ?? []).map((a: any) => ({
    id: typeof a.id === 'string' ? Number(a.id) : a.id,
  text: a.text,
  profileId: a.profile_id ?? undefined,
    topicId: a.topic_id ?? undefined,
    created_at: a.created_at ?? a.createdAt,
  }));

  const ids = answers.map((r: any) => Number(r.id)).filter(Boolean);
  const countsMap: Record<number, { level1: number; level2: number; level3: number }> = {};
  if (ids.length) {
    const { data: countsData, error: countsErr } = await supabase
      .from('answer_vote_counts')
      .select('answer_id, level1, level2, level3')
      .in('answer_id', ids);
    if (!countsErr && countsData && countsData.length) {
      for (const c of countsData) {
        countsMap[Number(c.answer_id)] = {
          level1: Number(c.level1 ?? 0),
          level2: Number(c.level2 ?? 0),
          level3: Number(c.level3 ?? 0),
        };
      }
    } else {
      // Fallback: fetch raw vote rows and aggregate client-side to avoid GROUP BY
      const { data: agg, error: aggErr } = await supabase
        .from('votes')
        .select('answer_id, level', { head: false })
        .in('answer_id', ids);
      if (aggErr) throw aggErr;
      for (const row of agg ?? []) {
        const aid = Number(row.answer_id);
        countsMap[aid] = countsMap[aid] ?? { level1: 0, level2: 0, level3: 0 };
        const lv = Number(row.level);
        if (lv === 1) countsMap[aid].level1 += 1;
        else if (lv === 2) countsMap[aid].level2 += 1;
        else if (lv === 3) countsMap[aid].level3 += 1;
      }
    }
  }

  // If profileId is provided, get user's favorites for sync
  let userFavorites: Set<number> = new Set();
  if (profileId && ids.length) {
    const userFavs = await getFavoritesForProfile(profileId, ids);
    userFavorites = new Set(userFavs);
  }

  const votesByMap = await getVotesByForAnswers(ids);

  const normalized = answers.map((a: any) => ({
    ...a,
    votes: countsMap[a.id] ?? { level1: 0, level2: 0, level3: 0 },
    votesBy: votesByMap[a.id] ?? {},
    favorited: profileId ? userFavorites.has(a.id) : undefined,
  }));

  return AnswerSchema.array().parse(normalized as any);
}

/**
 * getAnswersPageByTopic
 * Intent: Cursor based (created_at desc) pagination for answers under a topic to enable incremental loading.
 * Contract:
 *  - Input: { topicId: string|number; cursor: string | null; pageSize?: number }
 *  - Output: { answers: Answer[]; nextCursor: string | null }
 *    answers sorted desc by created_at. nextCursor = 最後の要素の created_at (次ページ条件 < cursor)。
 * Environment:
 *  - dev: in-memory filter + sort + slice
 *  - prod: Supabase query with .lt('created_at', cursor) when cursor provided
 * Errors: Supabase error そのまま throw。
 */
export async function getAnswersPageByTopic({
  topicId,
  cursor,
  pageSize = 20,
  profileId,
}: {
  topicId: string | number;
  cursor: string | null;
  pageSize?: number;
  profileId?: string;
}): Promise<{ answers: Answer[]; nextCursor: string | null }> {
  if (pageSize <= 0) return { answers: [], nextCursor: null };

  try {
    await ensureConnection();
  } catch (e) {
    // If connection cannot be established, return empty page quickly so UI can finish loading.
    // eslint-disable-next-line no-console
    console.error('getAnswersPageByTopic: ensureConnection failed, returning empty page', e);
    return { answers: [], nextCursor: null };
  }

  const numericTopic = Number(topicId);
  let query = supabase
    .from('answers')
    .select('id, text, profile_id, topic_id, created_at')
    .eq('topic_id', numericTopic)
    .order('created_at', { ascending: false })
    .limit(pageSize);
  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []).map((a: any) => ({
    id: typeof a.id === 'string' ? Number(a.id) : a.id,
    text: a.text,
    profileId: a.profile_id ?? undefined,
    topicId: a.topic_id ?? undefined,
    created_at: a.created_at ?? a.createdAt,
  }));

  const ids = rows.map((r: any) => Number(r.id)).filter(Boolean);
  const countsMap: Record<number, { level1: number; level2: number; level3: number }> = {};

  if (ids.length) {
    const { data: countsData, error: countsErr } = await supabase
      .from('answer_vote_counts')
      .select('answer_id, level1, level2, level3')
      .in('answer_id', ids);

    if (!countsErr && countsData && countsData.length) {
      for (const c of countsData) {
        countsMap[Number(c.answer_id)] = {
          level1: Number(c.level1 ?? 0),
          level2: Number(c.level2 ?? 0),
          level3: Number(c.level3 ?? 0),
        };
      }
    } else {
      const { data: agg, error: aggErr } = await supabase
        .from('votes')
        .select('answer_id, level', { head: false })
        .in('answer_id', ids);
      if (aggErr) throw aggErr;
      for (const row of agg ?? []) {
        const aid = Number(row.answer_id);
        countsMap[aid] = countsMap[aid] ?? { level1: 0, level2: 0, level3: 0 };
        const lv = Number(row.level);
        if (lv === 1) countsMap[aid].level1 += 1;
        else if (lv === 2) countsMap[aid].level2 += 1;
        else if (lv === 3) countsMap[aid].level3 += 1;
      }
    }
  }

  let userFavorites: Set<number> = new Set();
  if (profileId && ids.length) {
    const favs = await getFavoritesForProfile(profileId, ids);
    userFavorites = new Set(favs);
  }

  const votesByMap = ids.length ? await getVotesByForAnswers(ids) : {};

  const normalizedRows = rows.map((a: any) => ({
    ...a,
    votes: countsMap[a.id] ?? { level1: 0, level2: 0, level3: 0 },
    votesBy: votesByMap[a.id] ?? {},
    favorited: profileId ? userFavorites.has(a.id) : undefined,
  }));

  const answers = AnswerSchema.array().parse(normalizedRows as any);
  const next = answers.length === pageSize ? answers[answers.length - 1].created_at : null;
  return { answers, nextCursor: next };
}

/**
 * voteAnswer
 * Intent: record a three-level vote for an answer.
 * Contract: accepts answerId and level (1|2|3). Returns the updated Answer.
 * Environment: dev mutates in-memory mockAnswers and returns the parsed Answer. prod: not implemented.
 */
export async function voteAnswer({
  answerId,
  level,
  userId,
}: {
  answerId: number | string;
  level: 0 | 1 | 2 | 3;
  userId: string;
}): Promise<Answer> {
  const numericAnswerId = Number(answerId);
  if (!Number.isFinite(numericAnswerId)) {
    throw new Error('voteAnswer: answerId must be a finite number');
  }
  if (![0, 1, 2, 3].includes(level)) {
    throw new Error('voteAnswer: level must be 0 | 1 | 2 | 3');
  }
  if (!userId) {
    throw new Error('voteAnswer: userId is required');
  }

  await ensureConnection();
  const writeClient = supabaseAdmin ?? supabase;
  if (!writeClient) throw new Error('No Supabase client available for writes');

  const upsertPromise = (async () => {
    if (level === 0) {
      const { error } = await writeClient
        .from('votes')
        .delete()
        .eq('answer_id', numericAnswerId)
        .eq('profile_id', userId);
      if (error) throw error;
      return { data: null } as const;
    }

    return writeClient
      .from('votes')
      .upsert(
        { answer_id: numericAnswerId, profile_id: userId, level },
        { onConflict: 'answer_id,profile_id' }
      )
      .select('*')
      .single();
  })();

  const answerPromise = supabase
    .from('answers')
    .select('id, text, profile_id, topic_id, created_at')
    .eq('id', numericAnswerId)
    .single();

  const countsPromise = supabase
    .from('answer_vote_counts')
    .select('level1, level2, level3')
    .eq('answer_id', numericAnswerId)
    .single();

  const [upsertRes, answerRes, countsRes] = await Promise.all([
    upsertPromise,
    answerPromise,
    countsPromise,
  ]);

  const upsertError = (upsertRes as any).error;
  if (upsertError) throw upsertError;

  const answerRow = (answerRes as any).data;
  if (!answerRow) {
    throw new Error(`voteAnswer: answer ${numericAnswerId} not found`);
  }

  let counts = (countsRes as any).data as
    | { level1: number; level2: number; level3: number }
    | null;

  if (!counts) {
    const { data: agg, error: aggErr } = await supabase
      .from('votes')
      .select('level', { head: false })
      .eq('answer_id', numericAnswerId);
    if (aggErr) throw aggErr;
    const mapped = { level1: 0, level2: 0, level3: 0 };
    for (const row of agg ?? []) {
      const lv = Number(row.level);
      if (lv === 1) mapped.level1 += 1;
      else if (lv === 2) mapped.level2 += 1;
      else if (lv === 3) mapped.level3 += 1;
    }
    counts = mapped;
  }

  const votesObj = {
    level1: counts?.level1 ?? 0,
    level2: counts?.level2 ?? 0,
    level3: counts?.level3 ?? 0,
  };

  const { data: allVotes, error: allVotesErr } = await supabase
    .from('votes')
    .select('profile_id, level')
    .eq('answer_id', numericAnswerId);
  if (allVotesErr) throw allVotesErr;

  const votesByObj: Record<string, number> = {};
  for (const vote of allVotes ?? []) {
    if (!vote.profile_id) continue;
    votesByObj[String(vote.profile_id)] = Number(vote.level);
  }

  const result = {
    id: Number(answerRow.id),
    text: answerRow.text,
    profileId: answerRow.profile_id ?? undefined,
    topicId: answerRow.topic_id ?? undefined,
    created_at: answerRow.created_at,
    votes: votesObj,
    votesBy: votesByObj,
  } as const;

  try {
    invalidateCache('answers:all');
  } catch {}

  return AnswerSchema.parse(result as any);
}