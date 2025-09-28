import type { Route } from './+types/home';
import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { TopicCard } from '~/components/TopicCard';
// server-only import
import type { Topic } from '~/lib/schemas/topic';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'New React Router App' },
    { name: 'description', content: 'Welcome to React Router!' },
  ];
}

export async function loader(_args: LoaderFunctionArgs) {
  const { getLatestTopic } = await import('~/lib/db');
  const latest = await getLatestTopic();
  return { latest };
}

export default function Home() {
  type LoaderData = Awaited<ReturnType<typeof loader>>;
  const data = useLoaderData() as LoaderData;
  const latest: Topic | null = data?.latest ?? null;

  const current: Topic | null = latest;

  return (
    <main className="p-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-extrabold mb-6">Tsukkomi — 今日のお題</h1>

        {current ? (
          <section className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm rounded-lg p-6">
            <div>
              <TopicCard topic={current} />
            </div>
          </section>
        ) : (
          <div className="text-center text-gray-800 dark:text-gray-200">
            お題がまだありません。
          </div>
        )}
      </div>
    </main>
  );
}
