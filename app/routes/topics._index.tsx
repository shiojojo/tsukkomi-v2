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
          <li key={t.id} className="p-4 border rounded-md">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-medium">{t.title}</h2>
              </div>
              <Link to={`/topics/${t.id}`} className="text-sm text-blue-600">
                閲覧
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
