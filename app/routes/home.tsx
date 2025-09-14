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
  const { getTopics } = await import('~/lib/db');
  const topics = await getTopics();
  const latest = topics.length ? topics[0] : null;
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold leading-tight">
                  {latest.title}
                </h2>
                <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">
                  このお題に対する回答を見たり投稿できます。
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  to={`/topics/${latest.id}`}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
                >
                  回答を見る
                </Link>
                {/* '全ての回答へ' removed — use '回答を見る' which navigates to the topic page */}
              </div>
            </div>
          </section>
        ) : (
          <div className="text-center text-gray-800 dark:text-gray-200">
            お題がまだありません。
          </div>
        )}

        {/* User ranking removed */}
      </div>
    </main>
  );
}
