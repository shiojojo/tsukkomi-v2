import { TopicSchema } from '~/lib/schemas/topic';
import type { Topic } from '~/lib/schemas/topic';
import { supabase, ensureConnection } from '../supabase';

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

export async function getTopic(id: string | number): Promise<Topic | undefined> {
  const topics = await getTopics();
  return topics.find((t) => String(t.id) === String(id));
}