import { createHash } from 'node:crypto';
import { LineAnswerIngestRequestSchema, type LineAnswerIngestRequest } from '~/lib/schemas/line-sync';
import { supabase, supabaseAdmin, ensureConnection } from '../supabase';
import { withTiming } from './debug';

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



async function uploadImageToSupabaseStorage(sourceUrl: string) {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${sourceUrl}: ${response.status}`);
  }
  const contentType = response.headers.get('content-type');
  const extension = deriveImageExtension(sourceUrl, contentType);
  const storagePath = buildStoragePath(sourceUrl, extension);

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Resize image if needed
  let processedBuffer: Buffer = buffer;
  try {
    const { processImageBuffer } = await import('../imageProcessor');
    processedBuffer = await processImageBuffer(buffer, extension);
  } catch (error) {
    console.warn('Image processing failed, using original:', error);
  }

  const bucket = resolveStorageBucket();
  const storageClient = supabaseAdmin?.storage ?? supabase.storage;
  const { error } = await storageClient
    .from(bucket)
    .upload(storagePath, processedBuffer, {
      contentType: `image/${extension}`,
      upsert: true,
    });

  if (error) throw error;

  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(storagePath);

  return {
    path: storagePath,
    publicUrl: publicUrlData.publicUrl,
  };
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
async function _ingestLineAnswers(input: LineAnswerIngestRequest): Promise<LineAnswerIngestResult> {
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
  // Note: createdProfiles and updatedProfiles are tracked but not used here

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

export const ingestLineAnswers = withTiming(_ingestLineAnswers, 'ingestLineAnswers', 'lineSync');