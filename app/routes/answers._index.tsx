import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Link, useLocation } from 'react-router';
import { getAnswers, getTopics, getAnswersByTopic } from '~/lib/db';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const topicParam = url.searchParams.get('topic');

  const topics = await getTopics();
  const topicsById = Object.fromEntries(topics.map(t => [String(t.id), t]));

  let answers = [] as any;
  if (topicParam) {
    answers = await getAnswersByTopic(topicParam);
  } else {
    answers = await getAnswers();
  }

  return { answers, topicsById };
}

export default function AnswersRoute() {
  type LoaderData = Awaited<ReturnType<typeof loader>>;
  const data = useLoaderData() as LoaderData;
  const answers: Answer[] = data?.answers ?? [];
  const topicsById: Record<string, Topic> = (data as any)?.topicsById ?? {};
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const topicParam = params.get('topic');
  const pinnedTopic = topicParam ? topicsById[String(topicParam)] : undefined;

  return (
    <div className="p-4 max-w-3xl mx-auto flex flex-col">
      {/* Pinned header: shows selected topic or generic title. Sticky with responsive top offset so it won't be covered by the site's nav. */}
      <div className="sticky top-0 md:top-16 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
        <div className="p-4">
          {pinnedTopic ? (
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{pinnedTopic.title}</h2>
              <Link to="/topics" className="text-sm text-blue-600">
                お題一覧へ
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold">大喜利 - 回答一覧</h1>
              <Link to="/topics" className="text-sm text-blue-600">
                お題一覧へ
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable answers container.
          - On small screens we subtract space for the header + bottom nav (~56px each => 112px).
          - On md+ we subtract the top nav (approx 64px). These are reasonable assumptions based on the app's nav sizes.
        */}
      <div className="overflow-auto px-0 py-4 space-y-4 w-full max-h-[calc(100vh-112px)] md:max-h-[calc(100vh-64px)]">
        {answers.length === 0 ? (
          <p className="text-gray-600 px-4">まだ回答が投稿されていません。</p>
        ) : (
          <ul className="space-y-4 px-4">
            {answers.map(a => (
              <li
                key={a.id}
                className="p-4 border rounded-md bg-white/80 dark:bg-gray-950/80"
              >
                <p className="text-sm text-gray-600">
                  {new Date(a.created_at).toLocaleString()}
                </p>
                <p className="mt-2 text-lg">{a.text}</p>
                {a.topicId ? (
                  <p className="mt-2 text-xs text-gray-500">
                    お題:{' '}
                    {topicsById[String(a.topicId)] ? (
                      <Link
                        to={`/topics/${a.topicId}`}
                        className="text-blue-600"
                      >
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
        )}
      </div>
    </div>
  );
}
