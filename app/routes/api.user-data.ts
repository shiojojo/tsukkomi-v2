import type { LoaderFunctionArgs } from 'react-router';

/**
 * API endpoint to fetch user's vote and favorite data for answers
 * GET /api/user-data?profileId=...&answerIds=...&answerIds=...
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const profileId = url.searchParams.get('profileId');
  const answerIds = url.searchParams.getAll('answerIds').map(id => Number(id)).filter(Boolean);

  if (!profileId || answerIds.length === 0) {
    return new Response(JSON.stringify({ votes: {}, favorites: [] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { getProfileAnswerData } = await import('~/lib/db');
    const data = await getProfileAnswerData(profileId, answerIds);
    
    return new Response(JSON.stringify({
      votes: data.votes,
      favorites: Array.from(data.favorites)
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Failed to fetch user data:', error);
    return new Response(JSON.stringify({ 
      votes: {}, 
      favorites: [],
      error: error?.message || 'Failed to fetch user data'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
