import type { Route } from './+types/home';
import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Link } from 'react-router';
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

  return (
    <main className="p-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-extrabold mb-6">Tsukkomi — 今日のお題</h1>

        {latest ? (
          <section className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm rounded-lg p-6">
            <div>
              <Link
                to={`/topics/${latest.id}`}
                className="block p-0 border rounded-md overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label={`お題 ${latest.title} の回答を見る`}
              >
                {latest.image ? (
                  <div className="w-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                    <img
                      src={latest.image}
                      alt={latest.title}
                      className="w-full h-auto max-h-60 object-contain"
                    />
                  </div>
                ) : (
                  <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <h2 className="text-lg font-medium">{latest.title}</h2>
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
