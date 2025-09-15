import type { LoaderFunctionArgs } from 'react-router';

/**
 * Resource route: /topics/:id/answers?cursor=... 追加ページ取得。
 * Returns JSON { answers, nextCursor }
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  const id = String(params.id || '');
  if (!id) throw new Response('Bad Request', { status: 400 });
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get('cursor');
  const { getAnswersPageByTopic } = await import('~/lib/db');
  const page = await getAnswersPageByTopic({ topicId: id, cursor, pageSize: 20 });
  return new Response(JSON.stringify(page), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30, stale-while-revalidate=300' } });
}

export default function _() { return null; }
