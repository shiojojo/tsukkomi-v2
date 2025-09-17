import { mockAnswers } from '../mock/answers';
import { mockUsers } from '../mock/users';
import { mockTopics } from '../mock/topics';
import { mockComments } from '../mock/comments';
import { AnswerSchema } from '~/lib/schemas/answer';
import { TopicSchema } from '~/lib/schemas/topic';
import { CommentSchema } from '~/lib/schemas/comment';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { Comment } from '~/lib/schemas/comment';
import { UserSchema } from '~/lib/schemas/user';
import type { User, SubUser } from '~/lib/schemas/user';
import { supabase, supabaseAdmin, ensureConnection } from './supabase';

// Use mock data only when running in DEV and no Supabase key is provided.
// This lets local dev point at a real Supabase instance by setting VITE_SUPABASE_KEY or SUPABASE_KEY.
const _envKey = (import.meta.env.VITE_SUPABASE_KEY as string) ?? (process.env.SUPABASE_KEY as string | undefined);
const isDev = Boolean(import.meta.env.DEV) && !_envKey;
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
  if (isDev) {
    // copy to avoid mutating mock
    const copy = [...mockAnswers];
    copy.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    // validate shape
    return copy.map((c) => AnswerSchema.parse(c));
  }

  // Production: always fetch fresh answers from DB
  await ensureConnection();
  const { data: answerRows, error: answerErr } = await supabase
    .from('answers')
    // select only existing, minimal fields to reduce payload
    .select('id, text, author_name, author_id, topic_id, created_at')
    .order('created_at', { ascending: false });
  if (answerErr) throw answerErr;

  const answers = (answerRows ?? []).map((a: any) => ({
    id: typeof a.id === 'string' ? Number(a.id) : a.id,
    text: a.text,
    author: a.author_name ?? undefined,
    authorId: a.author_id ?? undefined,
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
  topicId?: string | number;
  page?: number;
  pageSize?: number;
  sortBy?: 'newest' | 'oldest' | 'scoreDesc';
  minScore?: number | undefined;
  hasComments?: boolean;
  fromDate?: string | undefined; // inclusive (YYYY-MM-DD or ISO)
  toDate?: string | undefined;   // inclusive (YYYY-MM-DD or ISO)
}): Promise<{ answers: Answer[]; total: number }> {
  const { q, topicId, page = 1, pageSize = 20, sortBy = 'newest', minScore, hasComments, fromDate, toDate } = opts;
  if (isDev) {
    // Filter mockAnswers in memory but page the result
    let arr = [...mockAnswers];
    if (topicId != null) arr = arr.filter(a => String(a.topicId) === String(topicId));
    if (q) {
      const low = q.toLowerCase();
      arr = arr.filter(a => String(a.text).toLowerCase().includes(low) || String(a.author ?? '').toLowerCase().includes(low));
    }
    // date filtering (inclusive). Accept date-only string => compare by date portion.
    if (fromDate) {
      const fromTs = new Date(fromDate).getTime();
      if (!Number.isNaN(fromTs)) arr = arr.filter(a => new Date(a.created_at).getTime() >= fromTs);
    }
    if (toDate) {
      // inclusive end-of-day: if only date provided, add 1 day -1ms
      let toTs = new Date(toDate).getTime();
      if (!Number.isNaN(toTs)) {
        // detect date-only (no 'T')
        if (!toDate.includes('T')) {
          const d = new Date(toTs);
            toTs = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - 1;
        }
        arr = arr.filter(a => new Date(a.created_at).getTime() <= toTs);
      }
    }
    // compute score and comments presence
    const withScore = arr.map(a => ({ a, score: ((a as any).votes?.level1 || 0) * 1 + ((a as any).votes?.level2 || 0) * 2 + ((a as any).votes?.level3 || 0) * 3 }));
    if (minScore != null) withScore.splice(0, withScore.length, ...withScore.filter(w => w.score >= minScore));
    if (hasComments) withScore.splice(0, withScore.length, ...withScore.filter(w => mockComments.some(c => String(c.answerId) === String((w.a as any).id))));
    if (sortBy === 'newest') withScore.sort((x, y) => new Date((y.a as any).created_at).getTime() - new Date((x.a as any).created_at).getTime());
    else if (sortBy === 'oldest') withScore.sort((x, y) => new Date((x.a as any).created_at).getTime() - new Date((y.a as any).created_at).getTime());
    else withScore.sort((x, y) => y.score - x.score);

    const total = withScore.length;
    const start = (page - 1) * pageSize;
    const pageSlice = withScore.slice(start, start + pageSize).map(w => AnswerSchema.parse(w.a));
    return { answers: pageSlice, total };
  }

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
    .select('id, text, author_name, author_id, topic_id, created_at', { count: 'exact' });
  if (topicId != null) baseQuery = baseQuery.eq('topic_id', Number(topicId));
  if (q) baseQuery = baseQuery.or(`text.ilike.*${q}*,author_name.ilike.*${q}*`);
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
    // fetch up to HARD_CAP rows (no manual pagination yet)
    const { data, error, count: c } = await baseQuery.range(0, HARD_CAP - 1);
    if (error) throw error;
    rows = data ?? [];
    count = c ?? rows.length; // base count before derived filter
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
    author: a.author_name ?? undefined,
    authorId: a.author_id ?? undefined,
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
  if (isDev) {
    const copy = mockComments.filter((c) => String(c.answerId) === String(answerId));
    copy.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    return copy.map((c) => CommentSchema.parse(c));
  }
  // production: fetch from Supabase directly
  const { data, error } = await supabase
    .from('comments')
    .select('id, answer_id, text, author_name, author_id, created_at')
    .eq('answer_id', Number(answerId))
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []).map((c: any) => ({
    id: typeof c.id === 'string' ? Number(c.id) : c.id,
    answerId: c.answer_id ?? c.answerId,
    text: c.text,
    author: c.author_name ?? c.author,
    authorId: c.author_id ?? c.authorId,
    created_at: c.created_at ?? c.createdAt,
  }));
  return CommentSchema.array().parse(rows as any);
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

  if (isDev) {
    const filtered = mockComments.filter((c) =>
      answerIds.map((id) => String(id)).includes(String(c.answerId))
    );
    filtered.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    for (const c of filtered) {
      const key = String(c.answerId);
      result[key] = result[key] ?? [];
      result[key].push(CommentSchema.parse(c));
    }
    // ensure every requested id has an array
    for (const id of answerIds) result[String(id)] = result[String(id)] ?? [];
    return result;
  }

  await ensureConnection();
  const numericIds = answerIds.map((id) => Number(id));
  const { data, error } = await supabase
    .from('comments')
    // select minimal fields
    .select('id, answer_id, text, author_name, author_id, created_at')
    .in('answer_id', numericIds)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const rows = (data ?? []).map((c: any) => ({
    id: typeof c.id === 'string' ? Number(c.id) : c.id,
    answerId: c.answer_id ?? c.answerId,
    text: c.text,
    author: c.author_name ?? c.author,
    authorId: c.author_id ?? c.authorId,
    created_at: c.created_at ?? c.createdAt,
  }));

  // Validate all rows at once, then group them. This reduces zod invocations and GC churn.
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

  // production
  // unreachable in current source order; placed here to keep diff minimal

/**
 * addComment
 * Intent: add a comment to an answer in dev (in-memory). Returns the created Comment.
 * Contract: input validated via CommentSchema (partial). In dev the function assigns an id and created_at.
 */
export async function addComment(input: { answerId: string | number; text: string; author?: string; authorId?: string; }): Promise<Comment> {
  if (isDev) {
    const nextId = mockComments.length ? Math.max(...mockComments.map((c) => Number(c.id))) + 1 : 1;
    const now = new Date().toISOString();
    const raw = {
      id: nextId,
      // store numeric answerId in mockComments for consistency
      answerId: Number(input.answerId),
      text: input.text,
      author: input.author ?? '',
      authorId: input.authorId ?? '',
      created_at: now,
    } as const;
    mockComments.push(raw);
    // invalidate any comment/answer caches so subsequent reads are fresh
    try {
      invalidateCache(`comments:answer:${String(input.answerId)}`);
      invalidateCache('answers:all');
    } catch {}
    return CommentSchema.parse(raw);
  }

  // production: insert into Supabase
  const payload = {
    answer_id: Number(input.answerId),
    text: input.text,
    author_name: input.author ?? null,
    author_id: input.authorId ?? null,
  } as const;
  await ensureConnection();
  // Use admin client for writes when available (server-only). Fall back to public client will fail if RLS blocks.
  const writeClient = supabaseAdmin ?? supabase;
  if (!supabaseAdmin && !writeClient) throw new Error('No Supabase client available for writes');

  const { data, error } = await writeClient
    .from('comments')
    .insert(payload)
    .select('id, answer_id, text, author_name, author_id, created_at')
    .single();
  if (error) throw error;
  // Normalize returned row before parsing
  const d = data as any;
  const row = {
    id: typeof d.id === 'string' ? Number(d.id) : d.id,
    answerId: d.answer_id ?? d.answerId,
    text: d.text,
    author: d.author_name ?? d.author,
    authorId: d.author_id ?? d.authorId,
    created_at: d.created_at ?? d.createdAt,
  };
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
  if (isDev) {
    const copy = [...mockTopics];
    // Sort topics by created_at desc when available. Fallback to id-based ordering.
    copy.sort((a, b) => {
      if (a.created_at && b.created_at) {
        return a.created_at < b.created_at ? 1 : -1;
      }
      const an = Number(a.id as any);
      const bn = Number(b.id as any);
      if (!Number.isNaN(an) && !Number.isNaN(bn)) return bn - an;
      return String(b.id) > String(a.id) ? 1 : -1;
    });
    return copy.map((t) => TopicSchema.parse(t));
  }
  if (DEBUG_DB_TIMINGS) console.time('db:ensureConnection');
  await ensureConnection();
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
 * getLatestTopic
 * Intent: return the single latest Topic (by created_at desc) used on home screens.
 * Contract: returns Topic or null when none exist.
 * Environment:
 *  - dev: returns the first topic from sorted mockTopics (or null)
 *  - prod: queries DB with ORDER BY created_at DESC LIMIT 1
 * Errors: zod parsing errors or Supabase errors will throw.
 */
export async function getLatestTopic(): Promise<Topic | null> {
  if (isDev) {
    const copy = [...mockTopics];
    copy.sort((a, b) => {
      if (a.created_at && b.created_at) return a.created_at < b.created_at ? 1 : -1;
      const an = Number(a.id as any);
      const bn = Number(b.id as any);
      if (!Number.isNaN(an) && !Number.isNaN(bn)) return bn - an;
      return String(b.id) > String(a.id) ? 1 : -1;
    });
    const first = copy[0];
    return first ? TopicSchema.parse(first) : null;
  }

  if (DEBUG_DB_TIMINGS) console.time('db:latestTopic:ensureConnection');
  await ensureConnection();
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
export async function getUsers(): Promise<User[]> {
  if (isDev) {
  // copy mock users but strip sensitive external identifiers (line_id) before returning
  const copy = [...mockUsers];
  const sanitized = copy.map((u) => ({ id: u.id, name: u.name, subUsers: u.subUsers ?? undefined }));
  return sanitized.map((u) => UserSchema.parse(u));
  }
  // Production: fetch profiles and attach sub_users without caching
  const { data, error } = await supabase.from('profiles').select('id, name');
    if (error) throw error;
    const baseRows = (data ?? []).map((r: any) => ({ id: String(r.id), name: r.name }));
    const ids = baseRows.map(r => r.id).filter(Boolean as any);
    let subMap: Record<string, { id: string; name: string }[]> = {};
    if (ids.length) {
      const { data: subs, error: subsErr } = await supabase
        .from('sub_users')
        .select('id, parent_user_id, name')
        .in('parent_user_id', ids as any[]);
      if (subsErr) throw subsErr;
      for (const s of (subs ?? [])) {
        const pid = String(s.parent_user_id ?? '');
        subMap[pid] = subMap[pid] ?? [];
        subMap[pid].push({ id: String(s.id), name: s.name });
      }
    }
    const rows = baseRows.map(r => ({ id: r.id, name: r.name, subUsers: subMap[r.id] ?? undefined }));
    return UserSchema.array().parse(rows as any);
}

/**
 * getUserById
 */
export async function getUserById(id: string): Promise<User | undefined> {
  if (isDev) {
    const users = await getUsers();
    return users.find((u) => u.id === id);
  }

  await ensureConnection();
  // Default public getter: do NOT return line_id. Use getUserByIdPrivate for server-only access.
  const { data, error } = await supabase.from('profiles').select('id, name').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  // fetch sub_users separately
  const { data: subs, error: subsErr } = await supabase.from('sub_users').select('id, parent_user_id, name').eq('parent_user_id', id);
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
  const { data, error } = await supabase.from('profiles').select('id, name, line_id').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  const { data: subs, error: subsErr } = await supabase.from('sub_users').select('id, parent_user_id, name').eq('parent_user_id', id);
  if (subsErr) throw subsErr;
  const normalized = { id: String(data.id), name: data.name, line_id: data.line_id ?? undefined, subUsers: (subs ?? []).map((s: any) => ({ id: String(s.id), name: s.name })) || undefined };
  return UserSchema.parse(normalized as any);
}

/**
 * getSubUsers
 * Intent: return subUsers for a parent user id in dev
 */
export async function getSubUsers(parentId: string): Promise<SubUser[] | undefined> {
  if (isDev) {
    const parent = mockUsers.find((u) => u.id === parentId);
    return parent?.subUsers;
  }

  await ensureConnection();
  const { data, error } = await supabase
  .from('sub_users')
  .select('id, parent_user_id, name')
  .eq('parent_user_id', parentId);
  if (error) throw error;
  // ensure shape matches SubUser type (id, name)
  return (data ?? []).map((r: any) => ({ id: String(r.id), name: r.name }));
}

/**
 * addSubUser
 * Intent: create a new sub-user in dev and return it
 * Contract: name validated elsewhere. id is generated to be unique within mockUsers.
 */
export async function addSubUser(input: { parentId: string; name: string }): Promise<SubUser> {
  if (isDev) {
    const parent = mockUsers.find((u) => u.id === input.parentId);
    if (!parent) throw new Error('Parent user not found');
    parent.subUsers = parent.subUsers ?? [];
    // generate a simple unique id using timestamp + length
    const id = `${parent.id}#sub-${Date.now()}-${parent.subUsers.length + 1}`;
    const sub = { id, name: input.name };
    parent.subUsers.push(sub);
  try { invalidateCache('profiles:all'); } catch {}
  return sub;
  }

  await ensureConnection();
  const writeClient = supabaseAdmin ?? supabase;
  if (!supabaseAdmin && !writeClient) throw new Error('No Supabase client available for writes');
  const { data, error } = await writeClient
    .from('sub_users')
    .insert({ parent_user_id: input.parentId, name: input.name })
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
  if (isDev) {
    const parent = mockUsers.find((u) => u.id === parentId);
    if (!parent || !parent.subUsers) return false;
    const idx = parent.subUsers.findIndex((s) => s.id === subId);
    if (idx === -1) return false;
    parent.subUsers.splice(idx, 1);
    // also clear any localStorage references is left to client; server-side returns success
  try { invalidateCache('profiles:all'); } catch {}
  return true;
  }

  await ensureConnection();
  const writeClient = supabaseAdmin ?? supabase;
  if (!supabaseAdmin && !writeClient) throw new Error('No Supabase client available for writes');
  const { error } = await writeClient
    .from('sub_users')
    .delete()
    .eq('id', subId)
    .eq('parent_user_id', parentId);
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
  if (isDev) {
    const answers = await getAnswers();
    return answers.filter((a) => a.topicId != null && String(a.topicId) === String(topicId));
  }

  await ensureConnection();
  const numericTopic = Number(topicId);
  const { data: answerRows, error: answerErr } = await supabase
    .from('answers')
    .select('id, text, author_name, author_id, topic_id, created_at')
    .eq('topic_id', numericTopic)
    .order('created_at', { ascending: false });
  if (answerErr) throw answerErr;

  const answers = (answerRows ?? []).map((a: any) => ({
    id: typeof a.id === 'string' ? Number(a.id) : a.id,
    text: a.text,
    author: a.author_name ?? undefined,
    authorId: a.author_id ?? undefined,
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
  if (isDev) {
    const all = await getAnswersByTopic(topicId);
    // ensure desc
    const sorted = [...all].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const sliced = cursor ? sorted.filter(a => a.created_at < cursor).slice(0, pageSize) : sorted.slice(0, pageSize);
    const next = sliced.length === pageSize ? sliced[sliced.length - 1].created_at : null;
    return { answers: sliced, nextCursor: next };
  }
  await ensureConnection();
  const numericTopic = Number(topicId);
  let query = supabase
    .from('answers')
    .select('id, text, author_name, author_id, topic_id, created_at')
    .eq('topic_id', numericTopic)
    .order('created_at', { ascending: false })
    .limit(pageSize);
  if (cursor) query = query.lt('created_at', cursor);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []).map((a: any) => ({
    id: typeof a.id === 'string' ? Number(a.id) : a.id,
    text: a.text,
    author: a.author_name ?? undefined,
    authorId: a.author_id ?? undefined,
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
  userId,
}: {
  answerId: number;
  level: 1 | 2 | 3;
  previousLevel?: number | null;
  userId?: string | null;
}): Promise<Answer> {
  if (isDev) {
    const idx = mockAnswers.findIndex((a) => a.id === answerId);
    if (idx === -1) throw new Error('Answer not found');

    const ans: any = mockAnswers[idx];
    // ensure votes object exists
    ans.votes = ans.votes ?? { level1: 0, level2: 0, level3: 0 };
    ans.votesBy = ans.votesBy ?? {};

    // If userId provided and previousLevel not provided, derive it from votesBy
    const derivedPrev = typeof userId === 'string' && ans.votesBy && ans.votesBy[userId] ? Number(ans.votesBy[userId]) : undefined;
    const prevToUse = previousLevel ?? derivedPrev;

    // If previousLevel provided or derived and different, decrement it (guard to non-negative)
    if (typeof prevToUse === 'number' && prevToUse !== level && [1, 2, 3].includes(prevToUse)) {
      if (prevToUse === 1) ans.votes.level1 = Math.max(0, (ans.votes.level1 || 0) - 1);
      else if (prevToUse === 2) ans.votes.level2 = Math.max(0, (ans.votes.level2 || 0) - 1);
      else if (prevToUse === 3) ans.votes.level3 = Math.max(0, (ans.votes.level3 || 0) - 1);
    }

    // Add the new vote
    if (level === 1) ans.votes.level1 = (ans.votes.level1 || 0) + 1;
    else if (level === 2) ans.votes.level2 = (ans.votes.level2 || 0) + 1;
    else if (level === 3) ans.votes.level3 = (ans.votes.level3 || 0) + 1;

    // record user selection
    if (typeof userId === 'string') {
      ans.votesBy[userId] = level;
    }

    // return validated copy
    return AnswerSchema.parse({ ...ans });
  }

  // production: require userId
  if (!userId) throw new Error('voteAnswer: userId required in production');

  // Upsert the user's vote for the answer
  await ensureConnection();
  // Use server/admin client for write operations in production.
  const writeClient = supabaseAdmin ?? supabase;
  if (!supabaseAdmin && !writeClient) throw new Error('No Supabase client available for writes');

  // Do the upsert and in parallel request the answer and vote counts to reduce round-trips.
  const upsertPromise = writeClient
  .from('votes')
  // votes table uses `actor_id` (see migrations). use actor_id to match schema.
  .upsert({ answer_id: answerId, actor_id: userId, level }, { onConflict: 'answer_id,actor_id' })
    .select('*')
    .single();

  const answerPromise = supabase
    .from('answers')
    .select('id, text, author_name, author_id, topic_id, created_at')
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
  if (userId) votesByObj[userId] = level;

  const result = {
    id: Number(answerRow.id),
    text: answerRow.text,
    author: answerRow.author_name ?? undefined,
    authorId: answerRow.author_id ?? undefined,
    topicId: answerRow.topic_id ?? undefined,
    created_at: answerRow.created_at,
    votes: votesObj,
    votesBy: votesByObj,
  } as const;

  // invalidate cached answers so clients see updated vote counts
  try { invalidateCache('answers:all'); } catch {}
  return AnswerSchema.parse(result as any);
}


