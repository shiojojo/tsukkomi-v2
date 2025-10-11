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
  const { getLatestTopic } = await import('~/lib/db');
  const latest = await getLatestTopic();
  return new Response(JSON.stringify({ latest }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default function Index() {
  return <Home />;
}
