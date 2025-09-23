import type { LoaderFunctionArgs } from 'react-router';

/**
 * Resource route: /topics/:id/comments/:answerId
 * Lazy-load comments for an answer when details panel opened.
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const answerId = params.answerId;
  if (!params.id || !answerId) throw new Response('Bad Request', { status: 400 });
  // loader invoked for resource - no debug logging in production code
  const { getCommentsByAnswer } = await import('~/lib/db');
  const comments = await getCommentsByAnswer(answerId);
  // resolve display names for returned comments to keep UI simple
  const { getProfilesByIds } = await import('~/lib/db');
  const profileIds = (comments || []).map(c => (c as any).profileId).filter(Boolean);
  const names = await getProfilesByIds(profileIds);
  const enriched = (comments || []).map(c => ({ ...c, displayName: names[String((c as any).profileId)] }));
  return new Response(JSON.stringify({ comments: enriched }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=5' } });
}

// Resource routes must not export a default React component. Keep this file
// as a resource-only module exporting loader (and optionally action) so the
// server responds with JSON instead of the client app shell.
