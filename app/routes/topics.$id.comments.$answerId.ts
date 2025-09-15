import type { LoaderFunctionArgs } from 'react-router';

/**
 * Resource route: /topics/:id/comments/:answerId
 * Lazy-load comments for an answer when details panel opened.
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const answerId = params.answerId;
  if (!params.id || !answerId) throw new Response('Bad Request', { status: 400 });
  const { getCommentsByAnswer } = await import('~/lib/db');
  const comments = await getCommentsByAnswer(answerId);
  return new Response(JSON.stringify({ comments }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=5' } });
}

export default function _() { return null; }
