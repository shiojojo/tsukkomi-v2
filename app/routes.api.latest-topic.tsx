import type { LoaderFunctionArgs } from 'react-router';

/**
 * 概要: 最新の Topic を返す API エンドポイント (/api/latest-topic)。
 * NOTE: Vercel / file-based routing のトップレベル /api 衝突を避けるため
 * routes/api/latest-topic ではなく dotted route (routes.api.latest-topic.tsx) を採用。
 * Contract: JSON { latest: Topic | null }
 * Cache: public, max-age=10, stale-while-revalidate=60
 */
export async function loader(_args: LoaderFunctionArgs) {
  const { getLatestTopic } = await import('~/lib/db');
  const latest = await getLatestTopic();
  return new Response(JSON.stringify({ latest }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=10, stale-while-revalidate=60',
    },
  });
}

export default function Route() {
  return null;
}
