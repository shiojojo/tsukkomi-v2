import type { Route } from './+types/home';
import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
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

  const { data: apiData } = useQuery({
    queryKey: ['latestTopic'],
    queryFn: async () => {
      const res = await fetch('/api/latest-topic');
      if (!res.ok) throw new Error('failed to fetch latest');
      return res.json();
    },
    initialData: { latest },
    staleTime: 10000,
    // avoid running during SSR; use loader's initial data on server and revalidate on client
    enabled: typeof window !== 'undefined',
  });

  const current: Topic | null = (apiData && apiData.latest) ?? latest;

  return (
    <main className="p-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-extrabold mb-6">Tsukkomi — 今日のお題</h1>

        {current ? (
          <section className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm rounded-lg p-6">
            <div>
              <Link
                to={`/topics/${current.id}`}
                className="block p-0 border rounded-md overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label={`お題 ${current.title} の回答を見る`}
              >
                {current.image ? (
                  <div className="w-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                    <img
                      src={current.image}
                      alt={current.title}
                      className="w-full h-auto max-h-60 object-contain"
                    />
                  </div>
                ) : (
                  <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <h2 className="text-lg font-medium">{current.title}</h2>
                  </div>
                )}
              </Link>
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
