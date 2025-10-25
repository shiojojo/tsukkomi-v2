import { CommentSchema } from '~/lib/schemas/comment';
import type { Comment } from '~/lib/schemas/comment';
import { supabase, supabaseAdmin, ensureConnection } from '../supabase';
import { withTiming } from './debug';

// Database row type for comments
interface DatabaseCommentRow {
  id: number;
  answer_id: number;
  text: string;
  profile_id: string;
  created_at: string;
}

async function _getCommentsByAnswer(answerId: string | number): Promise<Comment[]> {
  // Delegate to getCommentsForAnswers to avoid duplicated query/mapping logic
  const map = await getCommentsForAnswers([answerId]);
  return map[String(answerId)] ?? [];
}

export const getCommentsByAnswer = withTiming(_getCommentsByAnswer, 'getCommentsByAnswer', 'comments');

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
async function _getCommentsForAnswers(
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
  const mapRaw = (c: DatabaseCommentRow) => ({
    id: typeof c.id === 'string' ? Number(c.id) : c.id,
    answerId: c.answer_id,
    text: c.text,
    profileId: c.profile_id ?? undefined,
    created_at: c.created_at,
  });

  const rows = (data ?? []).map(mapRaw);
  const validated = CommentSchema.array().parse(rows as unknown);
  for (const r of validated) {
    const key = String(r.answerId);
    result[key] = result[key] ?? [];
    result[key].push(r);
  }

  // ensure every requested id has an array
  for (const id of answerIds) result[String(id)] = result[String(id)] ?? [];
  return result;
}

export const getCommentsForAnswers = withTiming(_getCommentsForAnswers, 'getCommentsForAnswers', 'comments');

async function _addComment(input: { answerId: string | number; text: string; profileId?: string; }): Promise<Comment> {
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

  // Map Supabase response fields to schema fields
  const mapped = {
    id: data.id,
    answerId: data.answer_id,
    text: data.text,
    profileId: data.profile_id,
    created_at: data.created_at,
  };

  return CommentSchema.parse(mapped);
}

export const addComment = withTiming(_addComment, 'addComment', 'comments');