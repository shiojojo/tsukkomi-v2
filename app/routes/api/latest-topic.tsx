import type { LoaderFunctionArgs } from 'react-router';

/**
 * 概要: 最新の Topic を返す API エンドポイント (/api/latest-topic)。
 * Contract:
 *   - Response JSON: { latest: Topic | null }
 *   - Cache: public, max-age=10, stale-while-revalidate=60 で短期 CDN / ブラウザキャッシュ許可
 * Environment: db 側で dev=mock / prod=DB を吸収
 * Errors: 内部で throw された場合はランタイムの 500 ハンドラに委ね
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

// Route component (API なので描画なし)
export default function Route() {
  return null;
}
