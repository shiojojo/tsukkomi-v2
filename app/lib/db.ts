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

// Use mock data only when running in DEV and no Supabase key is provided.
// This lets local dev point at a real Supabase instance by setting VITE_SUPABASE_KEY or SUPABASE_KEY.
const _envKey = (import.meta.env.VITE_SUPABASE_KEY as string) ?? (process.env.SUPABASE_KEY as string | undefined);
const isDev = Boolean(import.meta.env.DEV) && !_envKey;

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
  await ensureConnection();
  const { data, error } = await supabase
    .from('answers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => AnswerSchema.parse(r));
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
  await ensureConnection();
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('answer_id', Number(answerId))
    .order('created_at', { ascending: true });
  if (error) throw error;
  // Normalize DB (snake_case) -> application shape (camelCase) before zod parsing
  const rows = (data ?? []).map((c: any) => ({
    id: typeof c.id === 'string' ? Number(c.id) : c.id,
    answerId: c.answer_id ?? c.answerId,
    text: c.text,
    author: c.author_name ?? c.author,
    authorId: c.author_id ?? c.authorId,
    created_at: c.created_at ?? c.createdAt,
  }));
  return rows.map((c: any) => CommentSchema.parse(c));
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
    .select('*')
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

  for (const r of rows) {
    const key = String(r.answerId);
    result[key] = result[key] ?? [];
    result[key].push(CommentSchema.parse(r as any));
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
    return CommentSchema.parse(raw);
  }

  // production: insert into Supabase
  const payload = {
    answer_id: Number(input.answerId),
    text: input.text,
    author_name: input.author ?? null,
    author_id: input.authorId ?? null,
  } as const;
  const { data, error } = await supabase
    .from('comments')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  // Normalize returned row before parsing
  const row = {
    id: typeof data.id === 'string' ? Number(data.id) : data.id,
    answerId: data.answer_id ?? data.answerId,
    text: data.text,
    author: data.author_name ?? data.author,
    authorId: data.author_id ?? data.authorId,
    created_at: data.created_at ?? data.createdAt,
  };
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
  await ensureConnection();
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t: any) => TopicSchema.parse(t));
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
  await ensureConnection();
  const { data, error } = await supabase
    .from('profiles')
    .select('*');
  if (error) throw error;
  return (data ?? []).map((u: any) => UserSchema.parse(u));
}

/**
 * getUserById
 */
export async function getUserById(id: string): Promise<User | undefined> {
  const users = await getUsers();
  return users.find((u) => u.id === id);
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
    return sub;
  }

  await ensureConnection();
  const { data, error } = await supabase
    .from('sub_users')
    .insert({ parent_id: input.parentId, name: input.name })
    .select('*')
    .single();
  if (error) throw error;
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
    return true;
  }

  await ensureConnection();
  const { error } = await supabase
    .from('sub_users')
    .delete()
    .eq('id', subId)
    .eq('parent_id', parentId);
  if (error) throw error;
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
  const answers = await getAnswers();
  return answers.filter((a) => a.topicId != null && String(a.topicId) === String(topicId));
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
  const { data: voteRow, error: upsertError } = await supabase
    .from('votes')
    .upsert({ answer_id: answerId, user_id: userId, level }, { onConflict: 'answer_id,user_id' })
    .select('*')
    .single();
  if (upsertError) throw upsertError;

  // fetch answer
  const { data: answerRow, error: answerErr } = await supabase
    .from('answers')
    .select('*')
    .eq('id', answerId)
    .single();
  if (answerErr) throw answerErr;

  // fetch aggregated counts from materialized view or compute
  const { data: counts, error: countsErr } = await supabase
    .from('answer_vote_counts')
    .select('*')
    .eq('answer_id', answerId)
    .single();
  if (countsErr) {
    // fallback: compute from votes table
    const { data: agg, error: aggErr } = await supabase
      .from('votes')
      .select('level, count', { head: false });
    if (aggErr) throw aggErr;
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

  return AnswerSchema.parse(result as any);
}


