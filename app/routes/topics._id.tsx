import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Link } from 'react-router';
// server-only imports are done inside loader to avoid shipping Supabase client to the browser
import type { Topic } from '~/lib/schemas/topic';
import type { Answer } from '~/lib/schemas/answer';

export async function loader({ params }: LoaderFunctionArgs) {
  const id = Number(params.id);
  if (Number.isNaN(id)) {
    throw new Response('Invalid topic id', { status: 400 });
  }

  const { getTopics, getAnswers } = await import('~/lib/db');
  const topics = await getTopics();
  const topic = topics.find(t => Number((t as any).id) === id);
  if (!topic) {
    throw new Response('Not Found', { status: 404 });
  }

  const answers = await getAnswers();
  const filtered = answers.filter(
    a => a.topicId != null && Number((a as any).topicId) === id
  );

  return { topic, answers: filtered };
}

export default function TopicDetailRoute() {
  type LoaderData = Awaited<ReturnType<typeof loader>>;
  const data = useLoaderData() as LoaderData;
  const topic: Topic = data.topic;
  const answers: Answer[] = data.answers ?? [];

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">{topic.title}</h1>
        {/* removed: no need for topics index link here */}
      </div>

      {answers.length === 0 ? (
        <p className="text-gray-600">まだ回答が投稿されていません。</p>
      ) : (
        <ul className="space-y-4">
          {answers.map(a => (
            <li key={a.id} className="p-4 border rounded-md">
              <p className="text-sm text-gray-600">
                {new Date(a.created_at).toLocaleString()}
              </p>
              <p className="mt-2 text-lg">{a.text}</p>
              {a.author ? (
                <p className="mt-2 text-xs text-gray-500">— {a.author}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
