import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, Link } from 'react-router';
import { useState, useEffect } from 'react';
import { getTopic, getAnswersByTopic, voteAnswer, getUsers } from '~/lib/db';
import type { Topic } from '~/lib/schemas/topic';
import type { Answer } from '~/lib/schemas/answer';

// Shared button styles (mobile-first)
const CONTROL_BTN_BASE =
  'inline-flex items-center justify-center px-4 py-2 min-h-[44px] rounded-md text-sm font-medium border';
const CONTROL_BTN_ACTIVE = 'bg-blue-600 text-white border-blue-600';
const CONTROL_BTN_INACTIVE =
  'bg-white text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-100';

export async function loader({ params }: LoaderFunctionArgs) {
  const id = String(params.id || '');
  if (!id) {
    throw new Response('Invalid topic id', { status: 400 });
  }

  const [topic, answers, users] = await Promise.all([
    getTopic(id),
    getAnswersByTopic(id),
    getUsers(),
  ]);

  if (!topic) {
    throw new Response('Not Found', { status: 404 });
  }

  // annotate answers with voter details (name + level) so UI can show who voted what
  const usersMap = new Map(users.map(u => [u.id, u.name]));
  const answersWithVoters = answers.map(a => ({
    ...a,
    voters: Object.entries(a.votesBy || {}).map(([userId, lvl]) => ({
      id: userId,
      name: usersMap.get(userId) ?? userId,
      level: Number(lvl),
    })),
  }));

  return { topic, answers: answersWithVoters };
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
  // answers may be annotated with `voters: { id, name, level }[]`
  const answers: any[] = data.answers ?? [];
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
          {answers.map(a => (
            <AnswerCard key={a.id} answer={a} />
          ))}
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

  // counts are intentionally not shown in the UI; keep local state for potential future use
  const [counts, setCounts] = useState(() => ({ ...initialVotes }));

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

  const btnBase = CONTROL_BTN_BASE + ' gap-2 px-3';
  const active = CONTROL_BTN_ACTIVE;
  const inactive = CONTROL_BTN_INACTIVE;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleVote(1)}
        className={`${btnBase} ${selection === 1 ? active : inactive}`}
        aria-pressed={selection === 1}
        aria-label="投票1"
        type="button"
      >
        <span>1</span>
      </button>

      <button
        onClick={() => handleVote(2)}
        className={`${btnBase} ${selection === 2 ? active : inactive}`}
        aria-pressed={selection === 2}
        aria-label="投票2"
        type="button"
      >
        <span>2</span>
      </button>

      <button
        onClick={() => handleVote(3)}
        className={`${btnBase} ${selection === 3 ? active : inactive}`}
        aria-pressed={selection === 3}
        aria-label="投票3"
        type="button"
      >
        <span>3</span>
      </button>
    </div>
  );
}

function AnswerCard({ answer }: { answer: any }) {
  const a = answer;
  const votes = a.votes ?? { level1: 0, level2: 0, level3: 0 };
  const [open, setOpen] = useState(false);
  const detailsId = `answer-details-${a.id}`;

  return (
    <li className="p-4 md:p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md shadow-sm">
      <div className="flex flex-col gap-3">
        <p className="mt-0 text-2xl md:text-4xl leading-relaxed text-gray-800 dark:text-gray-100">
          {a.text}
        </p>

        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <button
              type="button"
              onClick={() => setOpen(s => !s)}
              className={`w-full md:w-auto ${CONTROL_BTN_BASE} text-blue-600 bg-transparent hover:bg-blue-50 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
              aria-expanded={open}
              aria-controls={detailsId}
            >
              {open ? '詳細を閉じる' : '詳細を見る'}
            </button>
          </div>

          <div className="flex-shrink-0">
            <NumericVoteButtons answerId={a.id} initialVotes={votes} />
          </div>
        </div>

        {open ? (
          <div id={detailsId} className="mt-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(a.created_at).toLocaleString()}
            </p>
            {a.author ? (
              <p className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                — {a.author}
              </p>
            ) : null}

            {a.voters && a.voters.length > 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                投票者:{' '}
                {a.voters.map((v: any, i: number) => (
                  <span key={v.id} className="mr-3">
                    {v.name} ({v.level}){i < a.voters.length - 1 ? ',' : ''}
                  </span>
                ))}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
