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
  const { getTopics } = await import('~/lib/db');
  const topics = await getTopics();
  const latest = topics.length ? topics[0] : null;
  return { latest };
}

export default function Index() {
  return <Home />;
}
