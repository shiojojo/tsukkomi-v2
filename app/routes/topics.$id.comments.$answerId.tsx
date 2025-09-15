import type { LoaderFunctionArgs } from 'react-router';

export async function loader({ params }: LoaderFunctionArgs) {
  const { id: topicId, answerId } = params;
  if (!answerId) return new Response('answerId required', { status: 400 });
  const { getCommentsByAnswer } = await import('~/lib/db');
  const comments = await getCommentsByAnswer(answerId);
  return new Response(JSON.stringify({ comments }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // allow short TTL caching on the client to avoid repeated identical fetches
      // (server-side cache in lib/db.ts still controls DB calls)
      'Cache-Control': 'public, max-age=10, stale-while-revalidate=30',
    },
  });
}

export default function Route() {
  return null;
}
