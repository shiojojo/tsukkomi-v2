import type { Route } from './+types/_index';
import type { LoaderFunctionArgs } from 'react-router';
import Home from './home';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Tsukkomi V2' },
    { name: 'description', content: 'Welcome to Tsukkomi V2!' },
  ];
}

export async function loader(_args: LoaderFunctionArgs) {
  try {
    const { getLatestTopic } = await import('~/lib/db');
    const latest = await getLatestTopic();
    return { latest };
  } catch (error) {
    console.error('Failed to load latest topic:', error);
    return new Response(
      JSON.stringify({ latest: null, error: 'Failed to load data' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export default function Index() {
  return <Home />;
}
