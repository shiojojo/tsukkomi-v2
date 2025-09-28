// Development in-memory mocks removed. This module now always uses Supabase via ensureConnection/supabase.
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { AnswerSchema } from '~/lib/schemas/answer';
import { TopicSchema } from '~/lib/schemas/topic';
import { CommentSchema } from '~/lib/schemas/comment';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { Comment } from '~/lib/schemas/comment';
import { UserSchema } from '~/lib/schemas/user';
import type { User, SubUser } from '~/lib/schemas/user';
import { IdentitySchema } from '~/lib/schemas/identity';
import { LineAnswerIngestRequestSchema, type LineAnswerIngestRequest } from '~/lib/schemas/line-sync';
import { supabase, supabaseAdmin, ensureConnection } from './supabase';
import { FavoriteSchema } from '~/lib/schemas/favorite';

// Running always in production-like mode: local development should run a Supabase instance and
// set VITE_SUPABASE_KEY / SUPABASE_KEY accordingly.
// Enable deprecation logging for migration debugging: set DEBUG_DB_DEPRECATION=1
// Legacy author deprecation removed: profileId is now authoritative.

const STORAGE_BUCKET =
  process.env.STORAGE_BUCKET ??
  (import.meta.env.STORAGE_BUCKET as string | undefined) ??
  process.env.VITE_STORAGE_BUCKET ??
  (import.meta.env.VITE_STORAGE_BUCKET as string | undefined) ??
  'images';

const STORAGE_FOLDER =
  process.env.STORAGE_FOLDER ??
  (import.meta.env.STORAGE_FOLDER as string | undefined) ??
  process.env.VITE_STORAGE_FOLDER ??
  (import.meta.env.VITE_STORAGE_FOLDER as string | undefined) ??
  'line-sync';

// Note: in-memory caching and edge-config have been removed to always query
// the database directly for freshest results and to avoid cache wait delays.
// keep a no-op invalidation function so existing mutation code can call it
// without conditional edits. This intentionally does nothing now.
function invalidateCache(_prefix: string) {
  // no-op: caching removed
}

function resolveStorageBucket() {
  if (!STORAGE_BUCKET) {
    throw new Error('Supabase storage bucket is not configured (STORAGE_BUCKET)');
  }
  return STORAGE_BUCKET;
}

function extFromContentType(contentType: string | null | undefined) {
  if (!contentType) return null;
  const normalized = contentType.split(';')[0]?.trim().toLowerCase();
  switch (normalized) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return null;
  }
}

function extFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const idx = pathname.lastIndexOf('.');
    if (idx >= 0 && idx < pathname.length - 1) {
      const extCandidate = pathname.slice(idx + 1).toLowerCase();
      if (/^[a-z0-9]{2,5}$/.test(extCandidate)) {
        return extCandidate.split('?')[0];
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function deriveImageExtension(sourceUrl: string, contentType: string | null | undefined) {
  return extFromContentType(contentType) ?? extFromUrl(sourceUrl) ?? 'jpg';
}

function buildStoragePath(sourceUrl: string, extension: string) {
  const hash = createHash('sha256').update(sourceUrl).digest('hex').slice(0, 32);
  const folder = STORAGE_FOLDER.replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '');
  const sanitizedExt = extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
  return `${folder}/${hash}.${sanitizedExt}`;
}

const THUMBNAIL_MAX_DIMENSION = 1024;
const JPEG_QUALITY = 80;
const WEBP_QUALITY = 75;

type ProcessedImage = {
  buffer: Buffer;
  extension: string;
  contentType: string;
};

async function createThumbnail(buffer: Buffer, extension: string): Promise<ProcessedImage | null> {
  const normalizedExt = extension.toLowerCase();
  const staticFormats = new Set(['jpg', 'jpeg', 'png', 'webp']);
  if (!staticFormats.has(normalizedExt)) {
    return null;
  }

  try {
    const image = sharp(buffer, { failOn: 'none' }).rotate();
    const pipeline = image.resize({
      width: THUMBNAIL_MAX_DIMENSION,
      height: THUMBNAIL_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    });

    if (normalizedExt === 'png') {
      const data = await pipeline
        .png({ compressionLevel: 9, palette: true })
        .toBuffer();
      return {
        buffer: data,
        extension: 'png',
        contentType: 'image/png',
      };
    }

    if (normalizedExt === 'webp') {
      const data = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
      return {
        buffer: data,
        extension: 'webp',
        contentType: 'image/webp',
      };
    }

    const data = await pipeline
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    return {
      buffer: data,
      extension: 'jpg',
      contentType: 'image/jpeg',
    };
  } catch (error) {
    console.error('createThumbnail failed, falling back to original image', error);
    return null;
  }
}

async function uploadImageToSupabaseStorage(sourceUrl: string) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is required to upload images');
  }

  const bucket = resolveStorageBucket();
  const response = await fetch(sourceUrl, {
    // Follow redirects for Google Drive download URLs
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${sourceUrl} (${response.status})`);
  }

  const contentType = response.headers.get('content-type');
  const originalExtension = deriveImageExtension(sourceUrl, contentType).toLowerCase();
  const buffer = Buffer.from(await response.arrayBuffer());

  const processed = await createThumbnail(buffer, originalExtension);
  const finalBuffer = processed?.buffer ?? buffer;
  const finalExtension = processed?.extension ?? originalExtension;
  const finalContentType = processed?.contentType ?? (() => {
    const normalizedType = contentType?.split(';')[0]?.trim().toLowerCase();
    if (normalizedType) return normalizedType;
    switch (finalExtension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      default:
        return 'application/octet-stream';
    }
  })();

  const objectPath = buildStoragePath(sourceUrl, finalExtension);

  const upload = await supabaseAdmin.storage.from(bucket).upload(objectPath, finalBuffer, {
    contentType: finalContentType,
    cacheControl: '31536000',
    upsert: false,
  });

  if (upload.error) {
    const message = String(upload.error.message ?? '').toLowerCase();
    if (!message.includes('duplicate')) {
      throw upload.error;
    }
  }

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(objectPath);

  return {
    path: objectPath,
    publicUrl: publicUrlData.publicUrl,
  };
}

/**
 * getAnswers
 * Intent: Retrieve a list of answers with vote counts.
 * Contract: returns Answer[] sorted by created_at desc, including vote counts.
 * Environment: Always uses Supabase.
 * Errors: zod parsing errors will throw.
 */
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

  const normalized = answers.map((a: any) => ({
    ...a,
    votes: countsMap[a.id] ?? { level1: 0, level2: 0, level3: 0 },
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
  const userFavorites = new Set(userFavs);

  return { votes: userVotes, favorites: userFavorites };
}

/**
 * Favorites: add/remove/get counts
 */
export async function addFavorite(input: { answerId: number | string; profileId: string }) {
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
  try { invalidateCache(`favorites:answer:${answerId}`); } catch {}
  return { success: true } as const;
}

export async function removeFavorite(input: { answerId: number | string; profileId: string }) {
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
  try { invalidateCache(`favorites:answer:${answerId}`); } catch {}
  return { success: true } as const;
}

export async function toggleFavorite(input: { answerId: number | string; profileId: string }) {
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

export async function getFavoriteCounts(answerIds: Array<number | string>) {
  const result: Record<number, number> = {};
  const ids = (answerIds ?? []).map((v) => Number(v)).filter(Boolean);
  if (!ids.length) return result;
  await ensureConnection();
  const { data, error } = await supabase
    .from('favorites')
    .select('answer_id')
    .in('answer_id', ids);
  if (error) throw error;
  for (const r of (data ?? [])) {
    const aid = Number(r.answer_id);
    result[aid] = (result[aid] ?? 0) + 1;
  }
  return result;
}

export async function getFavoritesForProfile(profileId: string, answerIds?: Array<number | string>) {
  await ensureConnection();
  let q = supabase.from('favorites').select('answer_id');
  q = q.eq('profile_id', profileId);
  if (answerIds && answerIds.length) q = q.in('answer_id', answerIds.map((v) => Number(v)).filter(Boolean));
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r: any) => Number(r.answer_id));
}

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
export async function getFavoriteAnswersForProfile(profileId: string): Promise<Answer[]> {
  if (!profileId) {
    throw new Error('getFavoriteAnswersForProfile: profileId is required');
  }

  await ensureConnection();
  const { data: favRows, error: favError } = await supabase
    .from('favorites')
    .select('answer_id, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });
  if (favError) throw favError;

  const orderedIds = (favRows ?? []).map((row: any) => Number(row.answer_id)).filter(Number.isFinite);
  if (!orderedIds.length) return [];

  const idOrder = new Map<number, number>();
  orderedIds.forEach((id, index) => {
    if (!idOrder.has(id)) idOrder.set(id, index);
  });
  const uniqueIds = Array.from(idOrder.keys());

  const { data: answerRows, error: answerErr } = await supabase
    .from('answers')
    .select('id, text, profile_id, topic_id, created_at')
    .in('id', uniqueIds);
  if (answerErr) throw answerErr;

  const answers = (answerRows ?? []).map((a: any) => ({
    id: typeof a.id === 'string' ? Number(a.id) : a.id,
    text: a.text,
    profileId: a.profile_id ?? undefined,
    topicId: a.topic_id ?? undefined,
    created_at: a.created_at ?? a.createdAt,
  }));

  const ids = answers.map((a) => Number(a.id)).filter(Number.isFinite);
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

  const profileData = await getProfileAnswerData(profileId, ids);

  const normalized = answers
    .map((a) => ({
      ...a,
      votes: countsMap[a.id] ?? { level1: 0, level2: 0, level3: 0 },
      votesBy:
        profileData.votes[a.id] != null
          ? { [profileId]: profileData.votes[a.id] }
          : {},
      favorited: true,
    }))
    .sort((a, b) => {
      const ai = idOrder.get(a.id) ?? 0;
      const bi = idOrder.get(b.id) ?? 0;
      return ai - bi;
    });

  return AnswerSchema.array().parse(normalized as any);
}

/**
 * Get user's votes for specific answers
 * Returns a map of answerId -> vote level
 */
export async function getVotesForProfile(profileId: string, answerIds?: Array<number | string>) {
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
}

/**
 * Get user's profile data including votes and favorites for answers
 * This ensures the latest data is always fetched from DB
 */
export async function getProfileAnswerData(profileId: string, answerIds: Array<number | string>) {
  const [votes, favorites] = await Promise.all([
    getVotesForProfile(profileId, answerIds),
    getFavoritesForProfile(profileId, answerIds)
  ]);
  
  return {
    votes,
    favorites: new Set(favorites)
  };
}


// Helper to record deprecation usage during tests or debug runs
// warnIfLegacyAuthorUsed removed as legacy fields are deleted

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

  return { answers: AnswerSchema.array().parse(answers), total: c ?? 0 };
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
  profileId: c.profile_id ?? c.profileId,
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
  profileId: d.profile_id ?? d.profileId,
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
  try {
    await ensureConnection();
  } catch (e) {
    // If connection probe fails, return a safe empty list so loaders can finish
    // quickly and the UI can show a fallback state instead of hanging.
    // eslint-disable-next-line no-console
    console.error('getTopics: ensureConnection failed, returning empty list', e);
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('topics')
      .select('id, title, created_at, image')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return TopicSchema.array().parse(data ?? []);
  } catch (error) {
    console.error('Topics query failed:', error);
    return []; // Return empty array on query failure
  }
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
  // NOTE: avoid a separate connection probe on the hot path to reduce initial
  // request latency. We rely on the actual topics query to surface network
  // errors quickly; callers receive null only if no topic exists.

  try {
    const { data, error } = await supabase
      .from('topics')
      .select('id, title, created_at, image')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = (data ?? [])[0] ?? null;
    return row ? TopicSchema.parse(row as any) : null;
  } catch (error) {
    console.error('Supabase connection failed in getLatestTopic:', error);
    return null; // Return null on connection failure
  }
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

  // If profileId is provided, get user's votes and favorites for sync
  let userVotes: Record<number, number> = {};
  let userFavorites: Set<number> = new Set();
  
  if (profileId && ids.length) {
    // Get user's votes for these answers
    const { data: voteData, error: voteErr } = await supabase
      .from('votes')
      .select('answer_id, level')
      .eq('profile_id', profileId)
      .in('answer_id', ids);
    
    if (!voteErr && voteData) {
      for (const vote of voteData) {
        userVotes[Number(vote.answer_id)] = vote.level;
      }
    }

    // Get user's favorites for these answers
    const userFavs = await getFavoritesForProfile(profileId, ids);
    userFavorites = new Set(userFavs);
  }

  const normalized = answers.map((a: any) => ({
    ...a,
    votes: countsMap[a.id] ?? { level1: 0, level2: 0, level3: 0 },
    votesBy: profileId && userVotes[a.id] ? { [profileId]: userVotes[a.id] } : {},
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
export async function getAnswersPageByTopic({ topicId, cursor, pageSize = 20, profileId }: { topicId: string | number; cursor: string | null; pageSize?: number; profileId?: string }): Promise<{ answers: Answer[]; nextCursor: string | null }> {
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

  // Get vote counts and user-specific data for these answers
  const ids = rows.map((r: any) => Number(r.id)).filter(Boolean);
  const countsMap: Record<number, { level1: number; level2: number; level3: number }> = {};
  let userVotes: Record<number, number> = {};
  let userFavorites: Set<number> = new Set();

  if (ids.length) {
    // Get vote counts
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
      // Fallback: aggregate from votes table
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

    // If profileId is provided, get user's votes and favorites for sync
    if (profileId) {
      // Get user's votes for these answers
      const { data: voteData, error: voteErr } = await supabase
        .from('votes')
        .select('answer_id, level')
        .eq('profile_id', profileId)
        .in('answer_id', ids);
      
      if (!voteErr && voteData) {
        for (const vote of voteData) {
          userVotes[Number(vote.answer_id)] = vote.level;
        }
      }

      // Get user's favorites for these answers
      const userFavs = await getFavoritesForProfile(profileId, ids);
      userFavorites = new Set(userFavs);
    }
  }

  const normalizedRows = rows.map((a: any) => ({
    ...a,
    votes: countsMap[a.id] ?? { level1: 0, level2: 0, level3: 0 },
    votesBy: profileId && userVotes[a.id] ? { [profileId]: userVotes[a.id] } : {},
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
  userId, // profileId
}: {
  answerId: number;
  level: 0 | 1 | 2 | 3; // 0 = remove existing vote
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
  
  // Get all current votes for this answer to provide accurate votesBy
  const { data: allVotes, error: allVotesErr } = await supabase
    .from('votes')
    .select('profile_id, level')
    .eq('answer_id', answerId);
  
  if (allVotesErr) throw allVotesErr;
  
  const votesByObj: Record<string, number> = {};
  for (const vote of (allVotes ?? [])) {
    votesByObj[vote.profile_id] = vote.level;
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

  // invalidate cached answers so clients see updated vote counts
  try { invalidateCache('answers:all'); } catch {}
  return AnswerSchema.parse(result as any);
}

export type LineAnswerIngestResult = {
  topicId: number;
  inserted: number;
  skipped: number;
  createdTopic: boolean;
  totalReceived: number;
  createdProfiles: number;
  updatedProfiles: number;
  uploadedImagePath?: string | null;
};

function normalizeLineAnswerText(text: string): string {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .trim();
}

/**
 * 概要: LINE (GAS) 側 cron から送信された回答バッチを topics/profiles/answers に取り込む集約処理。
 * Intent: 外部サービスからの一括同期を 1 箇所に閉じ、API ルートや他レイヤーからは関数呼び出しのみで完結させる。
 * Contract:
 *   - Input: LineAnswerIngestRequest (単一トピック + 回答配列)。topic.kind は text | image。
 *   - Output: LineAnswerIngestResult (挿入件数 / スキップ件数 / トピック作成有無 等)。
 * Environment:
 *   - 常に Supabase を利用。書き込みには supabaseAdmin (service key) を優先し、無ければ public client。
 * Errors: Supabase エラーやバリデーション失敗はそのまま throw (呼び出し元が 4xx/5xx を決定)。
 * SideEffects: profiles/topics/answers への insert/update。成功時に関連キャッシュキーを無効化。
 */
export async function ingestLineAnswers(input: LineAnswerIngestRequest): Promise<LineAnswerIngestResult> {
  const payload = LineAnswerIngestRequestSchema.parse(input);
  await ensureConnection();
  const writeClient = supabaseAdmin ?? supabase;
  if (!writeClient) throw new Error('No Supabase client configured for writes');
  const topicCreatedAt = payload.topic.createdAt ?? new Date().toISOString();

  let topicId: number | null = null;
  let createdTopic = false;
  let uploadedImagePath: string | null = null;

  if (payload.topic.kind === 'image') {
    const sourceImage = payload.topic.sourceImage;
    if (!sourceImage) throw new Error('Image topic requires sourceImage');
    const topicTitle = (payload.topic.title ?? '写真').trim() || '写真';

    const { data: topicExisting, error: topicQueryErr } = await writeClient
      .from('topics')
      .select('id, image, source_image')
      .eq('source_image', sourceImage)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (topicQueryErr && topicQueryErr.code !== 'PGRST116') throw topicQueryErr;

    if (topicExisting && topicExisting.id != null) {
      topicId = Number(topicExisting.id);
      // Upload image if missing or empty
      if (!topicExisting.image) {
        const uploadInfo = await uploadImageToSupabaseStorage(sourceImage);
        uploadedImagePath = uploadInfo.path;
        const { error: updateErr } = await writeClient
          .from('topics')
          .update({ image: uploadInfo.publicUrl, title: topicTitle })
          .eq('id', topicExisting.id);
        if (updateErr) throw updateErr;
        try { invalidateCache('topics:all'); } catch {}
      }
    } else {
      const uploadInfo = await uploadImageToSupabaseStorage(sourceImage);
      uploadedImagePath = uploadInfo.path;
      const { data: topicInserted, error: topicInsertErr } = await writeClient
        .from('topics')
        .insert({
          title: topicTitle,
          image: uploadInfo.publicUrl,
          source_image: sourceImage,
          created_at: topicCreatedAt,
        })
        .select('id')
        .single();
      if (topicInsertErr) throw topicInsertErr;
      topicId = Number(topicInserted.id);
      createdTopic = true;
      try { invalidateCache('topics:all'); } catch {}
    }
  } else {
    const topicTitle = payload.topic.title.trim();
    if (!topicTitle) {
      throw new Error('Topic title must not be empty');
    }

    const { data: topicExisting, error: topicQueryErr } = await writeClient
      .from('topics')
      .select('id, title')
      .eq('title', topicTitle)
      .is('image', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (topicQueryErr && topicQueryErr.code !== 'PGRST116') throw topicQueryErr;

    if (topicExisting && topicExisting.id != null) {
      topicId = Number(topicExisting.id);
    } else {
      const { data: topicInserted, error: topicInsertErr } = await writeClient
        .from('topics')
        .insert({ title: topicTitle, created_at: topicCreatedAt })
        .select('id')
        .single();
      if (topicInsertErr) throw topicInsertErr;
      topicId = Number(topicInserted.id);
      createdTopic = true;
      try { invalidateCache('topics:all'); } catch {}
    }
  }

  if (topicId == null || Number.isNaN(topicId)) {
    throw new Error('Failed to resolve topic id during ingestion');
  }

  const preferredNames = new Map<string, string>();
  for (const answer of payload.answers) {
    if (answer.displayName) {
      const trimmed = answer.displayName.trim();
      if (trimmed) preferredNames.set(answer.lineUserId, trimmed);
    }
  }

  const profileIdMap = new Map<string, string>();
  let createdProfiles = 0;
  let updatedProfiles = 0;
  const uniqueLineIds = Array.from(new Set(payload.answers.map(a => a.lineUserId)));
  for (const lineId of uniqueLineIds) {
    const displayName = preferredNames.get(lineId) ?? '名無し';
    const { data: existingProfile, error: profileQueryErr } = await writeClient
      .from('profiles')
      .select('id, name')
      .eq('line_id', lineId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (profileQueryErr && profileQueryErr.code !== 'PGRST116') throw profileQueryErr;

    if (existingProfile && existingProfile.id) {
      profileIdMap.set(lineId, String(existingProfile.id));
      if (displayName && displayName !== existingProfile.name) {
        const { error: updateErr } = await writeClient
          .from('profiles')
          .update({ name: displayName })
          .eq('id', existingProfile.id);
        if (updateErr) throw updateErr;
        updatedProfiles += 1;
      }
    } else {
      const { data: insertedProfile, error: profileInsertErr } = await writeClient
        .from('profiles')
        .insert({ name: displayName || '名無し', line_id: lineId })
        .select('id')
        .single();
      if (profileInsertErr) throw profileInsertErr;
      profileIdMap.set(lineId, String(insertedProfile.id));
      createdProfiles += 1;
    }
  }
  if (createdProfiles || updatedProfiles) {
    try { invalidateCache('profiles:all'); } catch {}
  }

  const { data: existingAnswers, error: existingAnswersErr } = await writeClient
    .from('answers')
    .select('profile_id, text')
    .eq('topic_id', topicId);
  if (existingAnswersErr) throw existingAnswersErr;
  const existingKeys = new Set<string>();
  for (const row of existingAnswers ?? []) {
    const profileId = row.profile_id ? String(row.profile_id) : '';
    existingKeys.add(`${profileId}::${normalizeLineAnswerText(row.text ?? '')}`);
  }

  const rowsToInsert: Array<{ topic_id: number; profile_id: string; text: string; created_at: string }> = [];
  let skipped = 0;
  for (const answer of payload.answers) {
    const profileId = profileIdMap.get(answer.lineUserId);
    if (!profileId) {
      skipped += 1;
      continue;
    }
    const normalizedText = normalizeLineAnswerText(answer.text);
    if (!normalizedText) {
      skipped += 1;
      continue;
    }
    const key = `${profileId}::${normalizedText}`;
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    existingKeys.add(key);
    const createdAt = answer.submittedAt ?? topicCreatedAt;
    rowsToInsert.push({
      topic_id: topicId,
      profile_id: profileId,
      text: normalizedText,
      created_at: createdAt,
    });
  }

  let inserted = 0;
  if (rowsToInsert.length) {
    const { data: insertedRows, error: insertErr } = await writeClient
      .from('answers')
      .insert(rowsToInsert)
      .select('id');
    if (insertErr) throw insertErr;
    inserted = insertedRows?.length ?? rowsToInsert.length;
    try { invalidateCache('answers:all'); } catch {}
  }

  return {
    topicId,
    inserted,
    skipped,
    createdTopic,
    totalReceived: payload.answers.length,
    createdProfiles,
    updatedProfiles,
    uploadedImagePath,
  };
}


