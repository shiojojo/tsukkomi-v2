import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, Link, Form, useFetcher } from 'react-router';
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
  if (!answerId || ![1, 2, 3].includes(level)) {
    return new Response('Invalid vote', { status: 400 });
  }

  const updated = await voteAnswer({ answerId, level, previousLevel });
  return { ok: true, answer: updated };
}

export default function TopicDetailRoute() {
  type LoaderData = Awaited<ReturnType<typeof loader>>;
  const data = useLoaderData() as LoaderData;
  const topic: Topic = data.topic;
  const answers: Answer[] = data.answers ?? [];
  const fetcher = useFetcher();

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
            // optimistic votes from fetcher (if this answer was just voted on)
            const pending =
              fetcher.formData &&
              Number(fetcher.formData.get('answerId')) === a.id
                ? Number(fetcher.formData.get('level'))
                : null;
            const votes = a.votes ?? { level1: 0, level2: 0, level3: 0 };
            const updating =
              fetcher.state !== 'idle' &&
              fetcher.formData &&
              Number(fetcher.formData.get('answerId')) === a.id;

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
                  {/* numeric unified buttons; client enforces single selection via localStorage */}
                  <NumericVoteButtons
                    answerId={a.id}
                    votes={votes}
                    fetcher={fetcher}
                    updating={!!updating}
                  />
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
  votes,
  fetcher,
  updating,
}: {
  answerId: number;
  votes: { level1: number; level2: number; level3: number };
  fetcher: any;
  updating: boolean;
}) {
  // localStorage key per answer
  const key = `vote:answer:${answerId}`;
  // read current selection
  const getStored = () => {
    try {
      const v = localStorage.getItem(key);
      return v ? (Number(v) as 1 | 2 | 3) : null;
    } catch {
      return null;
    }
  };

  const handleVote = (level: 1 | 2 | 3) => {
    const prev = getStored();
    if (prev === level) return; // no-op if choosing same

    // submit form with previousLevel so server can decrement
    const form = new FormData();
    form.set('answerId', String(answerId));
    form.set('level', String(level));
    if (prev) form.set('previousLevel', String(prev));

    // optimistic store
    try {
      localStorage.setItem(key, String(level));
    } catch {}

    fetcher.submit(form, { method: 'post' });
  };

  const current = typeof window !== 'undefined' ? getStored() : null;

  const btnBase =
    'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border';
  const active = 'bg-blue-600 text-white border-blue-600';
  const inactive = 'bg-white text-gray-800 border-gray-200';

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleVote(1)}
        className={`${btnBase} ${current === 1 ? active : inactive}`}
        aria-pressed={current === 1}
        aria-label="投票1"
        type="button"
      >
        1<span className="sr-only">: {votes.level1}</span>
      </button>
      <button
        onClick={() => handleVote(2)}
        className={`${btnBase} ${current === 2 ? active : inactive}`}
        aria-pressed={current === 2}
        aria-label="投票2"
        type="button"
      >
        2<span className="sr-only">: {votes.level2}</span>
      </button>
      <button
        onClick={() => handleVote(3)}
        className={`${btnBase} ${current === 3 ? active : inactive}`}
        aria-pressed={current === 3}
        aria-label="投票3"
        type="button"
      >
        3<span className="sr-only">: {votes.level3}</span>
      </button>
      {updating ? <span className="text-sm text-gray-500">投票中…</span> : null}
    </div>
  );
}
