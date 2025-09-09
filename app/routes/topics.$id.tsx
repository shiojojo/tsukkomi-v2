import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, Link } from 'react-router';
import { useState, useEffect } from 'react';
import { getTopic, getAnswersByTopic, voteAnswer } from '~/lib/db';
import type { Topic } from '~/lib/schemas/topic';
import type { Answer } from '~/lib/schemas/answer';

export async function loader({ params }: LoaderFunctionArgs) {
  const id = String(params.id || '');
  if (!id) {
    throw new Response('Invalid topic id', { status: 400 });
  }

  const [topic, answers] = await Promise.all([
    getTopic(id),
    getAnswersByTopic(id),
  ]);

  if (!topic) {
    throw new Response('Not Found', { status: 404 });
  }

  return { topic, answers };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const form = await request.formData();
  const answerId = Number(form.get('answerId'));
  const level = Number(form.get('level')) as 1 | 2 | 3;
  const previousLevel = form.get('previousLevel')
    ? Number(form.get('previousLevel'))
    : undefined;
  const userId = form.get('userId') ? String(form.get('userId')) : null;
  if (!answerId || ![1, 2, 3].includes(level)) {
    return new Response('Invalid vote', { status: 400 });
  }
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const updated = await voteAnswer({ answerId, level, previousLevel, userId });
  return { ok: true, answer: updated };
}

export default function TopicDetailRoute() {
  type LoaderData = Awaited<ReturnType<typeof loader>>;
  const data = useLoaderData() as LoaderData;
  const topic: Topic = data.topic;
  const answers: Answer[] = data.answers ?? [];
  // votes are handled locally for now; no server roundtrip on click.

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-extrabold leading-tight text-gray-900 dark:text-gray-100">
          {topic.title}
        </h1>
        <Link to="/topics" className="text-sm text-blue-600">
          お題一覧へ
        </Link>
      </div>

      {answers.length === 0 ? (
        <p className="text-gray-600">まだ回答が投稿されていません。</p>
      ) : (
        <ul className="space-y-5">
          {answers.map(a => {
            const votes = a.votes ?? { level1: 0, level2: 0, level3: 0 };
            return (
              <li
                key={a.id}
                className="p-4 md:p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md shadow-sm"
              >
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(a.created_at).toLocaleString()}
                </p>
                <p className="mt-2 text-base md:text-lg leading-relaxed text-gray-800 dark:text-gray-100">
                  {a.text}
                </p>
                {a.author ? (
                  <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                    — {a.author}
                  </p>
                ) : null}

                <div className="mt-4 flex items-center gap-3">
                  {/* numeric unified buttons; client enforces single selection via localStorage and local state */}
                  <NumericVoteButtons answerId={a.id} initialVotes={votes} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NumericVoteButtons({
  answerId,
  initialVotes,
}: {
  answerId: number;
  initialVotes: { level1: number; level2: number; level3: number };
}) {
  // local state for counts and selection. This intentionally keeps votes client-side only for now.
  const key = `vote:answer:${answerId}`;

  const readStored = () => {
    try {
      const v = localStorage.getItem(key);
      return v ? (Number(v) as 1 | 2 | 3) : null;
    } catch {
      return null;
    }
  };

  const [selection, setSelection] = useState<1 | 2 | 3 | null>(
    typeof window !== 'undefined' ? readStored() : null
  );

  const [counts, setCounts] = useState(() => ({ ...initialVotes }));

  useEffect(() => {
    // sync initial votes when component mounts
    setCounts({ ...initialVotes });
  }, [initialVotes.level1, initialVotes.level2, initialVotes.level3]);

  const handleVote = (level: 1 | 2 | 3) => {
    const prev = selection;
    if (prev === level) return; // toggle no-op (user keeps same)

    // update counts locally
    setCounts(c => {
      const next = { ...c };
      if (prev === 1) next.level1 = Math.max(0, next.level1 - 1);
      if (prev === 2) next.level2 = Math.max(0, next.level2 - 1);
      if (prev === 3) next.level3 = Math.max(0, next.level3 - 1);

      if (level === 1) next.level1 = (next.level1 || 0) + 1;
      if (level === 2) next.level2 = (next.level2 || 0) + 1;
      if (level === 3) next.level3 = (next.level3 || 0) + 1;
      return next;
    });

    try {
      localStorage.setItem(key, String(level));
    } catch {}
    setSelection(level);
  };

  const btnBase =
    'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border';
  const active = 'bg-blue-600 text-white border-blue-600';
  const inactive = 'bg-white text-gray-800 border-gray-200';

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleVote(1)}
        className={`${btnBase} ${selection === 1 ? active : inactive}`}
        aria-pressed={selection === 1}
        aria-label="投票1"
        type="button"
      >
        1<span className="sr-only">: {counts.level1}</span>
      </button>
      <button
        onClick={() => handleVote(2)}
        className={`${btnBase} ${selection === 2 ? active : inactive}`}
        aria-pressed={selection === 2}
        aria-label="投票2"
        type="button"
      >
        2<span className="sr-only">: {counts.level2}</span>
      </button>
      <button
        onClick={() => handleVote(3)}
        className={`${btnBase} ${selection === 3 ? active : inactive}`}
        aria-pressed={selection === 3}
        aria-label="投票3"
        type="button"
      >
        3<span className="sr-only">: {counts.level3}</span>
      </button>
    </div>
  );
}
