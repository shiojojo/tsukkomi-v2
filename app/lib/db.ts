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
import { supabase, ensureConnection } from './supabase';
import { getEdgeNumber } from './edge-config';

// Use mock data only when running in DEV and no Supabase key is provided.
// This lets local dev point at a real Supabase instance by setting VITE_SUPABASE_KEY or SUPABASE_KEY.
const _envKey = (import.meta.env.VITE_SUPABASE_KEY as string) ?? (process.env.SUPABASE_KEY as string | undefined);
const isDev = Boolean(import.meta.env.DEV) && !_envKey;

// Simple server-side in-memory cache to avoid repeated identical DB queries.
// Key design: short TTLs, manual invalidation on mutations.
type CacheEntry = { value: any; expires: number };
const _cache = new Map<string, CacheEntry>();
function getCached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const e = _cache.get(key);
  if (e && e.expires > now) return Promise.resolve(e.value as T);
  return loader().then((v) => {
    try {
      _cache.set(key, { value: v, expires: Date.now() + ttlMs });
    } catch {}
    return v;
  });
}
function invalidateCache(prefix: string) {
  for (const k of Array.from(_cache.keys())) {
    if (k === prefix || k.startsWith(prefix)) _cache.delete(k);
  }
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

  // Production path
  // cache answers for a short duration to avoid repeated heavy list queries
  const loader = async () => {
    const ttl = await getEdgeNumber('ttl_answers_ms', 5000);
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
          .select('answer_id, level, count', { head: false })
          .in('answer_id', ids);
        if (aggErr) throw aggErr;
        for (const row of agg ?? []) {
          const aid = Number(row.answer_id);
          countsMap[aid] = countsMap[aid] ?? { level1: 0, level2: 0, level3: 0 };
          const lv = Number(row.level);
          const cnt = Number(row.count ?? 0);
          if (lv === 1) countsMap[aid].level1 = cnt;
          else if (lv === 2) countsMap[aid].level2 = cnt;
          else if (lv === 3) countsMap[aid].level3 = cnt;
        }
      }
    }

    const normalized = answers.map((a: any) => ({
      ...a,
      votes: countsMap[a.id] ?? { level1: 0, level2: 0, level3: 0 },
      votesBy: {},
    }));

    return AnswerSchema.array().parse(normalized as any);
  };
  return getCached<Answer[]>('answers:all', await getEdgeNumber('ttl_answers_ms', 5000), loader);
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
  // production: fetch from Supabase
  const key = `comments:answer:${String(answerId)}`;
  return getCached<Comment[]>(key, 3000, async () => {
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
  });
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
  const { data, error } = await supabase
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
  return getCached<Topic[]>('topics:all', await getEdgeNumber('ttl_topics_ms', 10_000), async () => {
    const { data, error } = await supabase
      .from('topics')
      .select('id, title, created_at, image')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return TopicSchema.array().parse(data ?? []);
  });
}

/**
 * getUsers
 * Intent: return available users in dev (mock). prod: not implemented
 */
export async function getUsers(): Promise<User[]> {
  if (isDev) {
    const copy = [...mockUsers];
    return copy.map((u) => UserSchema.parse(u));
  }
  return getCached<User[]>('users:all', await getEdgeNumber('ttl_users_ms', 10_000), async () => {
    const { data, error } = await supabase.from('profiles').select('id, name, sub_users');
    if (error) throw error;
    return UserSchema.array().parse(data ?? []);
  });
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
  const { data, error } = await supabase.from('profiles').select('id, name, sub_users').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  return UserSchema.parse(data as any);
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
    .select('*')
    .eq('parent_id', parentId);
  if (error) throw error;
  return data ?? undefined;
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
  try { invalidateCache('users:all'); } catch {}
  return sub;
  }

  await ensureConnection();
  const { data, error } = await supabase
    .from('sub_users')
    .insert({ parent_id: input.parentId, name: input.name })
    .select('*')
    .single();
  if (error) throw error;
  try { invalidateCache('users:all'); } catch {}
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
  try { invalidateCache('users:all'); } catch {}
  return true;
  }

  await ensureConnection();
  const { error } = await supabase
    .from('sub_users')
    .delete()
    .eq('id', subId)
    .eq('parent_id', parentId);
  if (error) throw error;
  try { invalidateCache('users:all'); } catch {}
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
      const { data: agg, error: aggErr } = await supabase
        .from('votes')
        .select('answer_id, level, count', { head: false })
        .in('answer_id', ids);
      if (aggErr) throw aggErr;
      for (const row of agg ?? []) {
        const aid = Number(row.answer_id);
        countsMap[aid] = countsMap[aid] ?? { level1: 0, level2: 0, level3: 0 };
        const lv = Number(row.level);
        const cnt = Number(row.count ?? 0);
        if (lv === 1) countsMap[aid].level1 = cnt;
        else if (lv === 2) countsMap[aid].level2 = cnt;
        else if (lv === 3) countsMap[aid].level3 = cnt;
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

  // Do the upsert and in parallel request the answer and vote counts to reduce round-trips.
  const upsertPromise = supabase
    .from('votes')
    .upsert({ answer_id: answerId, user_id: userId, level }, { onConflict: 'answer_id,user_id' })
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
    const { data: agg, error: aggErr } = await supabase
      .from('votes')
      .select('level, count', { head: false })
      .eq('answer_id', answerId);
    if (aggErr) throw aggErr;
    // normalize aggregate to levels
    const mapped: any = { level1: 0, level2: 0, level3: 0 };
    for (const row of agg ?? []) {
      const lv = Number(row.level);
      const cnt = Number(row.count ?? 0);
      if (lv === 1) mapped.level1 = cnt;
      else if (lv === 2) mapped.level2 = cnt;
      else if (lv === 3) mapped.level3 = cnt;
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


