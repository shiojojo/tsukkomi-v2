import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Link } from 'react-router';
import { getAnswers, getTopics } from '~/lib/db';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';

export async function loader(_args: LoaderFunctionArgs) {
  const answers = await getAnswers();
  const topics = await getTopics();
  const topicsById = Object.fromEntries(topics.map(t => [String(t.id), t]));
  return { answers, topicsById };
}

export default function AnswersRoute() {
  type LoaderData = Awaited<ReturnType<typeof loader>>;
  const data = useLoaderData() as LoaderData;
  const answers: Answer[] = data?.answers ?? [];
  const topicsById: Record<string, Topic> = (data as any)?.topicsById ?? {};

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">大喜利 - 回答一覧</h1>
      <ul className="space-y-4">
        {answers.map(a => (
          <li key={a.id} className="p-4 border rounded-md">
            <p className="text-sm text-gray-600">
              {new Date(a.created_at).toLocaleString()}
            </p>
            <p className="mt-2 text-lg">{a.text}</p>
            {a.topicId ? (
              <p className="mt-2 text-xs text-gray-500">
                お題:{' '}
                {topicsById[String(a.topicId)] ? (
                  <Link to={`/topics/${a.topicId}`} className="text-blue-600">
                    {topicsById[String(a.topicId)].title}
                  </Link>
                ) : (
                  String(a.topicId)
                )}
              </p>
            ) : null}
            {a.author ? (
              <p className="mt-2 text-xs text-gray-500">— {a.author}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
