import { TopicSchema } from '~/lib/schemas/topic';
import type { Topic } from '~/lib/schemas/topic';
import { supabase, ensureConnection } from '../supabase';
import { ServerError } from '../errors';
import { withTiming } from './debug';

// Database row type for topics
interface DatabaseTopicRow {
  id: number;
  title: string;
  created_at: string;
  image: string | null;
}

async function _getTopics(): Promise<Topic[]> {
  await ensureConnection(); // 接続失敗時は throw

  const { data, error } = await supabase
    .from('topics')
    .select('id, title, created_at, image')
    .order('created_at', { ascending: false });
  if (error) throw new ServerError(`Failed to fetch topics: ${error.message}`);

  return TopicSchema.array().parse(data ?? []);
}

export const getTopics = withTiming(_getTopics, 'getTopics', 'topics');

/**
 * getTopicsPaged
 * Intent: server-driven pagination for topics listing with optional title/date filters.
 * Contract: returns { topics, total } where topics is the requested page slice and total is the total matching count.
 * Environment: always queries Supabase.
 */
async function _getTopicsPaged(opts: {
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
    .select('id, title, created_at, image', { count: 'estimated' });

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
  const rows = (data ?? []).map((r: DatabaseTopicRow) => ({ id: r.id, title: r.title, created_at: r.created_at, image: r.image }));
  return { topics: TopicSchema.array().parse(rows as unknown), total: Number(count ?? rows.length) };
}

export const getTopicsPaged = withTiming(_getTopicsPaged, 'getTopicsPaged', 'topics');

/**
 * getTopicsByIds
 * Intent: fetch specific topics by their IDs for efficient loading.
 * Contract: returns Topic[] for the given ids, in the order they appear in the DB.
 * Environment: always queries Supabase.
 * Errors: throws on DB errors.
 */
async function _getTopicsByIds(ids: number[]): Promise<Topic[]> {
  if (!ids.length) return [];

  await ensureConnection();

  const { data, error } = await supabase
    .from('topics')
    .select('id, title, created_at, image')
    .in('id', ids);
  if (error) throw new ServerError(`Failed to fetch topics by ids: ${error.message}`);

  return TopicSchema.array().parse(data ?? []);
}

export const getTopicsByIds = withTiming(_getTopicsByIds, 'getTopicsByIds', 'topics');

/**
 * getLatestTopic
 * Intent: return the single latest Topic (by created_at desc) used on home screens.
 * Contract: returns Topic or null when none exist.
 * Environment:
 *  - dev: returns the first topic from sorted mockTopics (or null)
 *  - prod: queries DB with ORDER BY id DESC LIMIT 1 (ID is auto-incrementing, so max ID = latest)
 * Errors: zod parsing errors or Supabase errors will throw.
 * Performance: Optimized to use ID-based ordering for fastest retrieval since ID is indexed primary key
 */
async function _getLatestTopic(): Promise<Topic | null> {
  // NOTE: avoid a separate connection probe on the hot path to reduce initial
  // request latency. We rely on the actual topics query to surface network
  // errors quickly; callers receive null only if no topic exists.

  // Use ID-based ordering for optimal performance (ID is primary key, auto-incrementing)
  const { data, error } = await supabase
    .from('topics')
    .select('id, title, created_at, image')
    .order('id', { ascending: false })
    .limit(1);

  if (error) throw new ServerError(`Failed to fetch latest topic: ${error.message}`);

  const row = (data ?? [])[0] ?? null;
  return row ? TopicSchema.parse(row as unknown) : null;
}

export const getLatestTopic = withTiming(_getLatestTopic, 'getLatestTopic', 'topics');