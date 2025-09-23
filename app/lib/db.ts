// Development in-memory mocks removed. This module now always uses Supabase via ensureConnection/supabase.
import { AnswerSchema } from '~/lib/schemas/answer';
import { TopicSchema } from '~/lib/schemas/topic';
import { CommentSchema } from '~/lib/schemas/comment';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { Comment } from '~/lib/schemas/comment';
import { UserSchema } from '~/lib/schemas/user';
import type { User, SubUser } from '~/lib/schemas/user';
import { IdentitySchema } from '~/lib/schemas/identity';
import { supabase, supabaseAdmin, ensureConnection } from './supabase';

// Running always in production-like mode: local development should run a Supabase instance and
// set VITE_SUPABASE_KEY / SUPABASE_KEY accordingly.
// Opt-in debug timings. Set DEBUG_DB_TIMINGS=1 in the environment to enable lightweight console timings
const DEBUG_DB_TIMINGS = Boolean(process.env.DEBUG_DB_TIMINGS ?? (import.meta.env.DEBUG_DB_TIMINGS as any) ?? false);

// Note: in-memory caching and edge-config have been removed to always query
// the database directly for freshest results and to avoid cache wait delays.
// keep a no-op invalidation function so existing mutation code can call it
// without conditional edits. This intentionally does nothing now.
function invalidateCache(_prefix: string) {
  // no-op: caching removed
}

/**
 * getAnswers
 * Intent: /routes should call this to retrieve 大喜利の回答一覧.
 * Contract: returns Answer[] sorted by created_at desc.
 * Environment:
 *  - dev: returns a copied, sorted array from mockAnswers
 *  - prod: Not implemented in this scaffold; implement Supabase client in app/lib/supabase.ts and update this file.
 * Errors: zod parsing errors will throw; prod will throw an Error until supabase is wired.
 */
export async function getAnswers(): Promise<Answer[]> {
  // always fetch fresh answers from DB
  await ensureConnection();
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

  // collect ids and fetch aggregated counts in one query (use materialized view if present)
  const ids = answers.map((r: any) => Number(r.id)).filter(Boolean);
  const countsMap: Record<number, { level1: number; level2: number; level3: number }> = {};
  if (ids.length) {
    // try counts view first
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
      // fallback: aggregate from votes table in one query
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

  const normalized = answers.map((a: any) => ({
    ...a,
    votes: countsMap[a.id] ?? { level1: 0, level2: 0, level3: 0 },
    votesBy: {},
  }));

  return AnswerSchema.array().parse(normalized as any);
}

/**
 * searchAnswers
 * Server-side paginated search to avoid loading all answers into memory.
 * Supports simple full-text (ilike) on text/author, topic filter, sorting and pagination.
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
  fromDate?: string | undefined; // inclusive (YYYY-MM-DD or ISO)
  toDate?: string | undefined;   // inclusive (YYYY-MM-DD or ISO)
}): Promise<{ answers: Answer[]; total: number }> {
  const { q, author, topicId, page = 1, pageSize = 20, sortBy = 'newest', minScore, hasComments, fromDate, toDate } = opts;
  await ensureConnection();
  // When minScore or hasComments filters are active, DB-side pagination cannot be trusted
  // because we must filter on derived data (vote score / comment existence). Strategy:
  //   1. Fetch ALL matching base answers (bounded by a hard cap) without pagination
  //   2. Fetch vote counts + (optional) comment presence for those ids
  //   3. Apply filters + sort in memory
  //   4. Slice for pagination
  // For large datasets a server-side materialized view should be introduced; acceptable trade-off now.

  const derivedFiltering = Boolean(minScore != null || hasComments);
  const HARD_CAP = 5000; // safeguard to avoid unbounded memory usage

  let baseQuery = supabase
    .from('answers')
    .select('id, text, profile_id, topic_id, created_at', { count: 'exact' });
  if (topicId != null) baseQuery = baseQuery.eq('topic_id', Number(topicId));
  // allow explicit author-only search via `author` param by resolving profile ids
  // NOTE: profiles are stored separately now (profile_id on answers). We map author
  // (profile.name) -> profile_id and filter by profile_id. If no matching profile is
  // found we can immediately return an empty result set to avoid extra DB work.
  if (author) {
    // profile names are authoritative; match exact stored name to find profile_id(s)
    const nameToMatch = String(author).trim();
    const { data: matchingProfiles, error: profErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('name', nameToMatch);
    if (profErr) throw profErr;
  // profile ids may be UUID strings; keep them as strings to avoid Number->NaN
  const profileIds = (matchingProfiles ?? []).map((p: any) => String(p.id)).filter(Boolean);
    if (profileIds.length === 0) {
      return { answers: [], total: 0 };
    }
    baseQuery = baseQuery.in('profile_id', profileIds);
  }
  // allow explicit author-only search via `author` param; for `q` we interpret it as
  // お題タイトル (topic title) search per UI label: resolve matching topics and
  // filter answers by topic_id. If no matching topic exists return empty result.
  if (q) {
    const nameToMatch = String(q).trim();
    const { data: matchingTopics, error: topicErr } = await supabase
      .from('topics')
      .select('id')
      .ilike('title', `%${nameToMatch}%`);
    if (topicErr) throw topicErr;
    const topicIds = (matchingTopics ?? []).map((t: any) => t.id).filter(Boolean);
    if (topicIds.length === 0) {
      return { answers: [], total: 0 };
    }
    baseQuery = baseQuery.in('topic_id', topicIds);
  }
  if (fromDate) {
    // direct gte for fromDate
    baseQuery = baseQuery.gte('created_at', fromDate.includes('T') ? fromDate : `${fromDate}T00:00:00.000Z`);
  }
  if (toDate) {
    // inclusive: if date-only, advance one day and use lt
    if (!toDate.includes('T')) {
      const d = new Date(toDate + 'T00:00:00.000Z');
      const next = new Date(d.getTime() + 24*60*60*1000); // +1 day
      baseQuery = baseQuery.lt('created_at', next.toISOString());
    } else {
      baseQuery = baseQuery.lte('created_at', toDate);
    }
  }
  // always order by created_at initially for deterministic results
  if (sortBy === 'oldest') baseQuery = baseQuery.order('created_at', { ascending: true });
  else baseQuery = baseQuery.order('created_at', { ascending: false });

  let rows: any[] | null = null;
  let count: number | null = null;
  if (derivedFiltering) {
    // Incremental, batched scan to avoid loading a very large set at once.
    // Strategy: fetch small batches (batchSize configurable), evaluate derived
    // filters for those ids (vote counts / comment presence), accumulate matches
    // until we have enough rows to serve the requested page or we hit maxScan.
    const batchSize = Math.min(Math.max(pageSize * 5, 50), 500); // 5x pageSize, clamped
    const maxScan = Math.min(HARD_CAP, 2000); // cap scanned rows (lower than HARD_CAP)
    let offset = 0;
    let scanned = 0;
    const matched: any[] = [];

    while (matched.length < pageSize * page && scanned < maxScan) {
      const end = offset + batchSize - 1;
      const { data: batchData, error: batchErr } = await baseQuery.range(offset, end);
      if (batchErr) throw batchErr;
      const batchRows = batchData ?? [];
      if (!batchRows.length) break; // no more rows available

      const ids = batchRows.map((r: any) => Number(r.id)).filter(Boolean);
      // fetch counts for this batch
      const countsMapBatch: Record<number, { level1: number; level2: number; level3: number }> = {};
      if (ids.length) {
        const { data: countsData, error: countsErr } = await supabase
          .from('answer_vote_counts')
          .select('answer_id, level1, level2, level3')
          .in('answer_id', ids);
        if (countsErr) throw countsErr;
        for (const c of countsData ?? []) {
          countsMapBatch[Number(c.answer_id)] = {
            level1: Number(c.level1 ?? 0),
            level2: Number(c.level2 ?? 0),
            level3: Number(c.level3 ?? 0),
          };
        }
      }

      // optional: fetch comment presence for this batch if needed
      let commentSetBatch: Set<number> | null = null;
      if (hasComments && ids.length) {
        const { data: commentIds, error: commentsErr } = await supabase
          .from('comments')
          .select('answer_id')
          .in('answer_id', ids);
        if (commentsErr) throw commentsErr;
        commentSetBatch = new Set((commentIds ?? []).map((r: any) => Number(r.answer_id)));
      }

      // evaluate batchRows against derived filters and push matching normalized rows
      for (const a of batchRows) {
        const id = typeof a.id === 'string' ? Number(a.id) : a.id;
        const counts = countsMapBatch[id] ?? { level1: 0, level2: 0, level3: 0 };
        const score = (counts.level1 || 0) * 1 + (counts.level2 || 0) * 2 + (counts.level3 || 0) * 3;
        if (typeof minScore === 'number' && !Number.isNaN(minScore) && score < (minScore as number)) continue;
        if (hasComments && commentSetBatch && !commentSetBatch.has(id)) continue;
        // keep original PostgREST field names (profile_id / topic_id) so later
        // normalization/mapping logic can read them consistently and not lose
        // the topic reference when derived filtering is active.
        matched.push({
          id,
          text: a.text,
          profile_id: a.profile_id ?? undefined,
          topic_id: a.topic_id ?? undefined,
          created_at: (a as any).created_at ?? (a as any).createdAt,
          votes: countsMapBatch[id] ?? { level1: 0, level2: 0, level3: 0 },
          votesBy: {},
        });
      }

      scanned += batchRows.length;
      offset += batchRows.length;
      // if batch was smaller than requested batchSize, no more data left
      if (batchRows.length < batchSize) break;
    }

    // matched now contains the rows that satisfied derived filters in scanned window
    const totalFiltered = matched.length;
    const start = (page - 1) * pageSize;
    const slice = matched.slice(start, start + pageSize);
    rows = slice;
    count = totalFiltered;
  } else {
    // normal fast path with DB pagination
    const offset = (page - 1) * pageSize;
    const { data, error, count: c } = await baseQuery.range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows = data ?? [];
    count = c ?? rows.length;
  }

  let answers = (rows ?? []).map((a: any) => ({
    id: typeof a.id === 'string' ? Number(a.id) : a.id,
    text: a.text,
  profileId: a.profile_id ?? undefined,
    topicId: a.topic_id ?? undefined,
    created_at: a.created_at ?? a.createdAt,
    votes: { level1: 0, level2: 0, level3: 0 },
    votesBy: {},
  }));

  // fetch vote counts for all loaded answers
  const ids = answers.map(r => Number(r.id)).filter(Boolean);
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

  // optional: comment presence filtering (we only need the set of answer ids that have comments)
  let commentSet: Set<number> | null = null;
  if (hasComments && ids.length) {
    const { data: commentIds, error: commentsErr } = await supabase
      .from('comments')
      .select('answer_id')
      .in('answer_id', ids);
    if (commentsErr) throw commentsErr;
    commentSet = new Set((commentIds ?? []).map((r: any) => Number(r.answer_id)));
  }

  // attach counts
  answers = answers.map(a => ({
    ...a,
    votes: countsMap[a.id] ?? { level1: 0, level2: 0, level3: 0 },
  }));

  if (derivedFiltering) {
    // compute score
    type WithScore = typeof answers[number] & { __score: number };
    let augmented: WithScore[] = answers.map(a => {
      const v = a.votes;
      const score = (v.level1 || 0) * 1 + (v.level2 || 0) * 2 + (v.level3 || 0) * 3;
      return { ...a, __score: score };
    });
    if (minScore != null) augmented = augmented.filter(a => a.__score >= (minScore as number));
    if (hasComments && commentSet) augmented = augmented.filter(a => commentSet!.has(a.id));
    // sort (scoreDesc overrides created_at ordering)
    if (sortBy === 'scoreDesc') augmented.sort((a, b) => b.__score - a.__score || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sortBy === 'oldest') augmented.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else augmented.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const totalFiltered = augmented.length;
    const start = (page - 1) * pageSize;
    const slice = augmented.slice(start, start + pageSize).map(a => ({ ...a }));
    return { answers: AnswerSchema.array().parse(slice as any), total: totalFiltered };
  }

  // scoreDesc sorting without derived filters (we only loaded one page; need counts for those only)
  if (sortBy === 'scoreDesc') {
    answers.sort((a, b) => {
      const av = a.votes; const bv = b.votes;
      const as = (av.level1||0) + (av.level2||0)*2 + (av.level3||0)*3;
      const bs = (bv.level1||0) + (bv.level2||0)*2 + (bv.level3||0)*3;
      if (bs !== as) return bs - as;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  return { answers: AnswerSchema.array().parse(answers as any), total: Number(count ?? answers.length) };
}

/**
 * getCommentsByAnswer
 * Intent: return comments for a given answer id (dev: from mockComments).
 * Contract: answerId coerced to string for comparison. Returns Comment[] sorted by created_at asc.
 */
export async function getCommentsByAnswer(answerId: string | number): Promise<Comment[]> {
  // Delegate to getCommentsForAnswers to avoid duplicated query/mapping logic
  const map = await getCommentsForAnswers([answerId]);
  return map[String(answerId)] ?? [];
}

/**
 * getCommentsForAnswers
 * Intent: fetch comments for multiple answer ids in a single query to avoid N+1 queries
 * Contract:
 *  - Input: array of answer ids (string|number)
 *  - Output: Record<string, Comment[]> mapped by String(answerId)
 * Environment:
 *  - dev: filter `mockComments` and group them client-side
 *  - prod: single Supabase .in('answer_id', ids) query, normalized and grouped
 */
export async function getCommentsForAnswers(
  answerIds: Array<string | number>
): Promise<Record<string, Comment[]>> {
  const result: Record<string, Comment[]> = {};
  if (!answerIds || answerIds.length === 0) return result;
  await ensureConnection();
  const numericIds = answerIds.map((id) => Number(id));
  const { data, error } = await supabase
    .from('comments')
    // do not join profiles(name): we intentionally avoid resolving display names at DB layer
    .select('id, answer_id, text, profile_id, created_at')
    .in('answer_id', numericIds)
    .order('created_at', { ascending: true });
  if (error) throw error;

  // helper: normalize raw postgrest row into Comment
  // Note: we no longer resolve profile names here. Return profile id only.
  const mapRaw = (c: any) => ({
    id: typeof c.id === 'string' ? Number(c.id) : c.id,
    answerId: c.answer_id ?? c.answerId,
    text: c.text,
  profileId: c.profile_id ?? c.profileId ?? c.authorId,
    created_at: c.created_at ?? c.createdAt,
  });

  const rows = (data ?? []).map(mapRaw);
  const validated = CommentSchema.array().parse(rows as any);
  for (const r of validated) {
    const key = String(r.answerId);
    result[key] = result[key] ?? [];
    result[key].push(r);
  }

  // ensure every requested id has an array
  for (const id of answerIds) result[String(id)] = result[String(id)] ?? [];
  return result;
}

/**
 * getProfilesByIds
 * Intent: bulk-resolve profile id -> display name mapping.
 * Contract: accepts array of profile id strings, returns Record<id, name>.
 * Environment: always queries Supabase.
 */
export async function getProfilesByIds(ids: Array<string | number>): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const uniq = Array.from(new Set((ids ?? []).map(id => String(id)).filter(Boolean)));
  if (uniq.length === 0) return result;
  await ensureConnection();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', uniq);
  if (error) throw error;
  for (const r of (data ?? [])) {
    if (r && r.id) result[String(r.id)] = r.name;
  }
  return result;
}

  // production
  // unreachable in current source order; placed here to keep diff minimal

/**
 * addComment
 * Intent: add a comment to an answer in dev (in-memory). Returns the created Comment.
 * Contract: input validated via CommentSchema (partial). In dev the function assigns an id and created_at.
 */
export async function addComment(input: { answerId: string | number; text: string; profileId?: string; }): Promise<Comment> {
  // insert into Supabase
  const payload = {
    answer_id: Number(input.answerId),
    text: input.text,
  profile_id: input.profileId ?? null,
  } as const;
  await ensureConnection();
  // Use admin client for writes when available (server-only). Fall back to public client will fail if RLS blocks.
  const writeClient = supabaseAdmin ?? supabase;
  if (!supabaseAdmin && !writeClient) throw new Error('No Supabase client available for writes');

  const { data, error } = await writeClient
    .from('comments')
    .insert(payload)
    .select('id, answer_id, text, profile_id, created_at')
    .single();
  if (error) throw error;
  const d = data as any;

  // Reuse the same mapping logic used by getCommentsForAnswers
  const mapped = {
    id: typeof d.id === 'string' ? Number(d.id) : d.id,
    answerId: d.answer_id ?? d.answerId,
    text: d.text,
  profileId: d.profile_id ?? d.profileId ?? d.authorId,
    created_at: d.created_at ?? d.createdAt,
  };

  const row = mapped;
  // clear related caches after successful insert
  try {
    invalidateCache(`comments:answer:${String(input.answerId)}`);
    invalidateCache('answers:all');
  } catch {}
  return CommentSchema.parse(row as any);
}

/**
 * getTopics
 * Intent: return the list of Topics available in the app.
 * Contract: returns Topic[] sorted by id asc.
 * Environment:
 *  - dev: returns copy of mockTopics
 *  - prod: not implemented
 */
export async function getTopics(): Promise<Topic[]> {
  if (DEBUG_DB_TIMINGS) console.time('db:ensureConnection');
  try {
    await ensureConnection();
  } catch (e) {
    // If connection probe fails, return a safe empty list so loaders can finish
    // quickly and the UI can show a fallback state instead of hanging.
    // eslint-disable-next-line no-console
    console.error('getTopics: ensureConnection failed, returning empty list', e);
    return [];
  }
  if (DEBUG_DB_TIMINGS) console.timeEnd('db:ensureConnection');

  if (DEBUG_DB_TIMINGS) console.time('db:topicsQuery');
  const { data, error } = await supabase
    .from('topics')
    .select('id, title, created_at, image')
    .order('created_at', { ascending: false });
  if (DEBUG_DB_TIMINGS) console.timeEnd('db:topicsQuery');
  if (error) throw error;
  return TopicSchema.array().parse(data ?? []);
}

/**
 * getTopicsPaged
 * Intent: server-driven pagination for topics listing with optional title/date filters.
 * Contract: returns { topics, total } where topics is the requested page slice and total is the total matching count.
 * Environment: always queries Supabase.
 */
export async function getTopicsPaged(opts: {
  page?: number;
  pageSize?: number;
  q?: string | undefined;
  fromDate?: string | undefined;
  toDate?: string | undefined;
}): Promise<{ topics: Topic[]; total: number }> {
  const { page = 1, pageSize = 10, q, fromDate, toDate } = opts;
  await ensureConnection();

  let query = supabase
    .from('topics')
    .select('id, title, created_at, image', { count: 'exact' });

  if (q) query = query.ilike('title', `%${String(q).trim()}%`);
  if (fromDate) query = query.gte('created_at', fromDate.includes('T') ? fromDate : `${fromDate}T00:00:00.000Z`);
  if (toDate) {
    if (!toDate.includes('T')) {
      const d = new Date(toDate + 'T00:00:00.000Z');
      const next = new Date(d.getTime() + 24 * 60 * 60 * 1000);
      query = query.lt('created_at', next.toISOString());
    } else {
      query = query.lte('created_at', toDate);
    }
  }

  // order by created_at desc by default
  query = query.order('created_at', { ascending: false });

  const offset = (page - 1) * pageSize;
  const { data, error, count } = await query.range(offset, offset + pageSize - 1);
  if (error) throw error;
  const rows = (data ?? []).map((r: any) => ({ id: r.id, title: r.title, created_at: r.created_at ?? r.createdAt, image: r.image }));
  return { topics: TopicSchema.array().parse(rows as any), total: Number(count ?? rows.length) };
}

/**
 * getLatestTopic
 * Intent: return the single latest Topic (by created_at desc) used on home screens.
 * Contract: returns Topic or null when none exist.
 * Environment:
 *  - dev: returns the first topic from sorted mockTopics (or null)
 *  - prod: queries DB with ORDER BY created_at DESC LIMIT 1
 * Errors: zod parsing errors or Supabase errors will throw.
 */
export async function getLatestTopic(): Promise<Topic | null> {
  if (DEBUG_DB_TIMINGS) console.time('db:latestTopic:ensureConnection');
  try {
    await ensureConnection();
  } catch (e) {
    // If probe fails, return null quickly so callers can render fallback UI.
    // eslint-disable-next-line no-console
    console.error('getLatestTopic: ensureConnection failed, returning null', e);
    return null;
  }
  if (DEBUG_DB_TIMINGS) console.timeEnd('db:latestTopic:ensureConnection');

  if (DEBUG_DB_TIMINGS) console.time('db:latestTopic:query');
  const { data, error } = await supabase
    .from('topics')
    .select('id, title, created_at, image')
    .order('created_at', { ascending: false })
    .limit(1);
  if (DEBUG_DB_TIMINGS) console.timeEnd('db:latestTopic:query');
  if (error) throw error;
  const row = (data ?? [])[0] ?? null;
  return row ? TopicSchema.parse(row as any) : null;
}

/**
 * getUsers
 * Intent: return available users in dev (mock). prod: not implemented
 */
export async function getUsers(opts?: { limit?: number; onlyMain?: boolean }): Promise<User[]> {
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
    const identitiesTmp = (data ?? []).map((r: any) => IdentitySchema.parse({ id: String(r.id), parentId: r.parent_id ? String(r.parent_id) : null, name: r.name, line_id: r.line_id ?? undefined, created_at: r.created_at }));
    const mains = identitiesTmp.filter(i => i.parentId == null);
    const rows = mains.map(m => ({ id: m.id, name: m.name, line_id: m.line_id, subUsers: identitiesTmp.filter(c => c.parentId === m.id).map(c => ({ id: c.id, name: c.name, line_id: c.line_id })) }));
    return UserSchema.array().parse(rows as any);
  }

  // limited fetch: get first `limit` profiles (may include mains and subs), then
  // determine mains and fetch their sub-users explicitly.
  const { data: dataLimited, error: errLimited } = await supabase
    .from('profiles')
    .select('id, parent_id, name, line_id, created_at')
    .order('created_at', { ascending: false })
    .range(0, limit - 1);
  if (errLimited) throw errLimited;
  const fetched = (dataLimited ?? []).map((r: any) => IdentitySchema.parse({ id: String(r.id), parentId: r.parent_id ? String(r.parent_id) : null, name: r.name, line_id: r.line_id ?? undefined, created_at: r.created_at }));

  const mains = fetched.filter(i => i.parentId == null);
  const mainIds = mains.map(m => m.id).filter(Boolean);

  // fetch sub-users belonging to these mains (if any)
  let subs: any[] = [];
  if (mainIds.length) {
    const { data: subData, error: subErr } = await supabase
      .from('profiles')
      .select('id, parent_id, name, line_id')
      .in('parent_id', mainIds);
    if (subErr) throw subErr;
    subs = (subData ?? []).map((r: any) => IdentitySchema.parse({ id: String(r.id), parentId: r.parent_id ? String(r.parent_id) : null, name: r.name, line_id: r.line_id ?? undefined, created_at: r.created_at }));
  }

  const rows = mains.map(m => ({
    id: m.id,
    name: m.name,
    line_id: m.line_id,
    subUsers: subs.filter((c: any) => c.parentId === m.id).map((c: any) => ({ id: c.id, name: c.name, line_id: c.line_id })),
  }));

  return UserSchema.array().parse(rows as any);
}

/**
 * getUserById
 */
export async function getUserById(id: string): Promise<User | undefined> {
  await ensureConnection();
  // Default public getter: do NOT return line_id. Use getUserByIdPrivate for server-only access.
  const { data, error } = await supabase.from('profiles').select('id, parent_id, name, line_id').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  // fetch sub_users separately
  const { data: subs, error: subsErr } = await supabase.from('profiles').select('id, parent_id, name, line_id').eq('parent_id', id);
  if (subsErr) throw subsErr;
  const normalized = { id: String(data.id), name: data.name, subUsers: (subs ?? []).map((s: any) => ({ id: String(s.id), name: s.name })) || undefined };
  return UserSchema.parse(normalized as any);
}

/**
 * getUserByIdPrivate
 * Server-only: returns user's profile including line_id for integration workflows.
 */
export async function getUserByIdPrivate(id: string): Promise<User | undefined> {
  await ensureConnection();
  const { data, error } = await supabase.from('profiles').select('id, parent_id, name, line_id').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  const { data: subs, error: subsErr } = await supabase.from('profiles').select('id, parent_id, name, line_id').eq('parent_id', id);
  if (subsErr) throw subsErr;
  const normalized = { id: String(data.id), name: data.name, line_id: data.line_id ?? undefined, subUsers: (subs ?? []).map((s: any) => ({ id: String(s.id), name: s.name })) || undefined };
  return UserSchema.parse(normalized as any);
}

/**
 * getSubUsers
 * Intent: return subUsers for a parent user id in dev
 */
export async function getSubUsers(parentId: string): Promise<SubUser[] | undefined> {
  await ensureConnection();
  const { data, error } = await supabase
  .from('profiles')
    .select('id, parent_id, name')
    .eq('parent_id', parentId);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: String(r.id), name: r.name }));
}

/**
 * addSubUser
 * Intent: create a new sub-user in dev and return it
 * Contract: name validated elsewhere. id is generated to be unique within mockUsers.
 */
export async function addSubUser(input: { parentId: string; name: string }): Promise<SubUser> {
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
  try { invalidateCache('profiles:all'); } catch {}
  return data as SubUser;
}

/**
 * removeSubUser
 * Intent: delete a sub-user from parent in dev and return boolean
 */
export async function removeSubUser(parentId: string, subId: string): Promise<boolean> {
  await ensureConnection();
  await ensureConnection();
  const writeClient = supabaseAdmin ?? supabase;
  if (!supabaseAdmin && !writeClient) throw new Error('No Supabase client available for writes');
  const { error } = await writeClient
  .from('profiles')
  .delete()
  .eq('id', subId)
  .eq('parent_id', parentId);
  if (error) throw error;
  try { invalidateCache('profiles:all'); } catch {}
  return true;
}

/**
 * getTopic
 * Intent: return a single Topic by id (string|number). Returns undefined when not found.
 */
export async function getTopic(id: string | number): Promise<Topic | undefined> {
  const topics = await getTopics();
  return topics.find((t) => String(t.id) === String(id));
}

/**
 * getAnswersByTopic
 * Intent: return answers that belong to a given topic id.
 * Contract: topicId may be string or number. Comparison coerces both sides to string.
 */
export async function getAnswersByTopic(topicId: string | number) {
  try {
    await ensureConnection();
  } catch (e) {
    // If connection fails, return empty answers to avoid hanging loaders.
    // eslint-disable-next-line no-console
    console.error('getAnswersByTopic: ensureConnection failed, returning empty list', e);
    return [];
  }
  const numericTopic = Number(topicId);
  const { data: answerRows, error: answerErr } = await supabase
    .from('answers')
  .select('id, text, profile_id, topic_id, created_at')
    .eq('topic_id', numericTopic)
    .order('created_at', { ascending: false });
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

  const normalized = answers.map((a: any) => ({
    ...a,
    votes: countsMap[a.id] ?? { level1: 0, level2: 0, level3: 0 },
    votesBy: {},
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
export async function getAnswersPageByTopic({ topicId, cursor, pageSize = 20 }: { topicId: string | number; cursor: string | null; pageSize?: number }): Promise<{ answers: Answer[]; nextCursor: string | null }> {
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
    votes: { level1: 0, level2: 0, level3: 0 },
    votesBy: {},
  }));
  const answers = AnswerSchema.array().parse(rows as any);
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
  previousLevel,
  userId, // profileId
}: {
  answerId: number;
  level: 0 | 1 | 2 | 3; // 0 = remove existing vote
  previousLevel?: number | null;
  userId?: string | null;
}): Promise<Answer> {
  
  // production: require userId
  if (!userId) throw new Error('voteAnswer: profileId required');

  // Upsert the user's vote for the answer
  await ensureConnection();
  // Use server/admin client for write operations in production.
  const writeClient = supabaseAdmin ?? supabase;
  if (!supabaseAdmin && !writeClient) throw new Error('No Supabase client available for writes');

  // If level = 0, remove existing vote row; else upsert.
  const upsertPromise = (async () => {
    if (level === 0) {
      const { error } = await writeClient
        .from('votes')
        .delete()
  .eq('answer_id', answerId)
	.eq('profile_id', userId);
      if (error) throw error;
      return { data: null } as any;
    }
    return writeClient
      .from('votes')
      .upsert(
  { answer_id: answerId, profile_id: userId, level },
  { onConflict: 'answer_id,profile_id' }
      )
      .select('*')
      .single();
  })();

  const answerPromise = supabase
    .from('answers')
  .select('id, text, profile_id, topic_id, created_at')
    .eq('id', answerId)
    .single();

  // Try materialized view first (faster if present). If it errors, we'll fall back to aggregate query.
  const countsPromise = supabase
    .from('answer_vote_counts')
    .select('level1, level2, level3')
    .eq('answer_id', answerId)
    .single();

  const [upsertRes, answerRes, countsRes] = await Promise.all([upsertPromise, answerPromise, countsPromise]);

  const upsertError = (upsertRes as any).error;
  if (upsertError) throw upsertError;

  const answerRow = (answerRes as any).data;
  const counts = (countsRes as any).data;

  // If counts view missing or empty, compute from votes table (single aggregate query)
  if (!counts) {
    // Fetch raw vote rows for the answer and aggregate client-side to avoid
    // relying on DB-level GROUP BY via PostgREST which may return 'count' only
    const { data: agg, error: aggErr } = await supabase
      .from('votes')
      .select('level', { head: false })
      .eq('answer_id', answerId);
    if (aggErr) throw aggErr;
    const mapped: any = { level1: 0, level2: 0, level3: 0 };
    for (const row of agg ?? []) {
      const lv = Number(row.level);
      if (lv === 1) mapped.level1 += 1;
      else if (lv === 2) mapped.level2 += 1;
      else if (lv === 3) mapped.level3 += 1;
    }
    Object.assign((counts as any) ?? {}, mapped);
  }

  const votesObj = {
  level1: counts?.level1 ?? 0,
  level2: counts?.level2 ?? 0,
  level3: counts?.level3 ?? 0,
  };
  const votesByObj: Record<string, number> = {};
  if (userId && level !== 0) votesByObj[userId] = level;

  const result = {
    id: Number(answerRow.id),
  text: answerRow.text,
  profileId: answerRow.profile_id ?? undefined,
    topicId: answerRow.topic_id ?? undefined,
    created_at: answerRow.created_at,
    votes: votesObj,
    votesBy: votesByObj,
  } as const;

  // invalidate cached answers so clients see updated vote counts
  try { invalidateCache('answers:all'); } catch {}
  return AnswerSchema.parse(result as any);
}


