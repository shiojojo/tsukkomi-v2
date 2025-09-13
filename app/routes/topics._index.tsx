import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Link } from 'react-router';
import { getTopics } from '~/lib/db';
import type { Topic } from '~/lib/schemas/topic';

export async function loader(_args: LoaderFunctionArgs) {
  const topics = await getTopics();
  return { topics };
}

export default function TopicsRoute() {
  type LoaderData = Awaited<ReturnType<typeof loader>>;
  const data = useLoaderData() as LoaderData;
  const topics: Topic[] = data?.topics ?? [];

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">お題一覧</h1>
      <ul className="space-y-3">
        {topics.map(t => (
          <li key={t.id}>
            <Link
              to={`/topics/${t.id}`}
              className="block p-0 border rounded-md overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={`お題 ${t.title} の回答を見る`}
            >
              {t.image ? (
                // Image-only topic: show the entire photo (no cropping).
                <div className="w-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                  <img
                    src={t.image}
                    alt={t.title}
                    className="w-full h-auto max-h-60 object-contain"
                  />
                </div>
              ) : (
                <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <h2 className="text-lg font-medium">{t.title}</h2>
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
