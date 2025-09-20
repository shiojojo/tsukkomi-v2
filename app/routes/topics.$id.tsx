import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, Link, Form } from 'react-router';
import { useState, useEffect } from 'react';
// server-only imports are dynamically loaded inside loader/action
import type { Comment } from '~/lib/schemas/comment';
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
  // Only fetch the topic and answer summaries here.
  // Comments and any user-detail enrichment are intentionally loaded lazily on the client
  // to avoid N+1 and large joins on initial page render.
  const { getTopic, getAnswersByTopic } = await import('~/lib/db');
  const [topic, answers] = await Promise.all([
    getTopic(id),
    getAnswersByTopic(id),
  ]);

  if (!topic) {
    throw new Response('Not Found', { status: 404 });
  }

  return { topic, answers };
}

function FavoriteButton({ answerId }: { answerId: number }) {
  // read current user from localStorage (development login helper stores these)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [fav, setFav] = useState<boolean>(false);

  useEffect(() => {
    try {
      // prefer an explicitly selected sub-user identity when present
      const uid =
        localStorage.getItem('currentSubUserId') ??
        localStorage.getItem('currentUserId');
      setCurrentUserId(uid);
      if (uid) {
        const key = `favorite:answer:${answerId}:user:${uid}`;
        setFav(localStorage.getItem(key) === '1');
      }
    } catch {
      setCurrentUserId(null);
      setFav(false);
    }
  }, [answerId]);

  useEffect(() => {
    try {
      if (!currentUserId) return;
      const key = `favorite:answer:${answerId}:user:${currentUserId}`;
      localStorage.setItem(key, fav ? '1' : '0');
    } catch {
      // noop
    }
  }, [fav, answerId, currentUserId]);

  const handleClick = () => {
    if (!currentUserId) {
      // redirect to login page in dev scaffold
      try {
        window.location.href = '/login';
      } catch {
        // noop
      }
      return;
    }
    setFav(s => !s);
  };

  return (
    <button
      type="button"
      aria-pressed={fav}
      onClick={handleClick}
      className={`p-2 rounded-md ${fav ? 'text-red-500' : 'text-gray-400'} hover:opacity-90`}
      title={
        !currentUserId
          ? 'ログインしてお気に入り登録'
          : fav
            ? 'お気に入り解除'
            : 'お気に入り'
      }
    >
      {fav ? (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      ) : (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24z" />
        </svg>
      )}
    </button>
  );
}

export async function action({ request, params }: ActionFunctionArgs) {
  const form = await request.formData();
  // comment submission (no auth required in this scaffold)
  const commentText = form.get('commentText');
  if (commentText) {
    const answerIdRaw = form.get('answerId');
    const authorId = form.get('authorId')
      ? String(form.get('authorId'))
      : undefined;
    const authorName = form.get('authorName')
      ? String(form.get('authorName'))
      : undefined;
    if (!answerIdRaw) return new Response('Invalid', { status: 400 });
    const { addComment, voteAnswer } = await import('~/lib/db');
    await addComment({
      answerId: String(answerIdRaw),
      text: String(commentText),
      author: authorName,
      authorId,
    });
    return { ok: true };
  }
  const answerId = Number(form.get('answerId'));
  const levelRaw = Number(form.get('level'));
  const level = levelRaw as 0 | 1 | 2 | 3; // 0 means remove vote
  const previousLevel = form.get('previousLevel')
    ? Number(form.get('previousLevel'))
    : undefined;
  const userId = form.get('userId') ? String(form.get('userId')) : null;
  if (!answerId || ![0, 1, 2, 3].includes(level))
    return new Response('Invalid vote', { status: 400 });
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { voteAnswer } = await import('~/lib/db');
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
      {/* Sticky header */}
      <div
        className={`sticky top-0 z-30 ${
          topic.image
            ? 'bg-transparent pt-0 pb-0'
            : 'bg-white dark:bg-gray-950 pt-4 pb-2'
        }`}
      >
        <div className="mb-4">
          <div className="w-full">
            {topic.image ? (
              // Photo-only topic: use the same layout as the topics list so the image centers the same way.
              <div className="block p-0 border rounded-md overflow-hidden">
                <div className="w-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                  <img
                    src={topic.image}
                    alt={topic.title}
                    className="w-full h-auto max-h-60 object-contain"
                  />
                </div>
              </div>
            ) : (
              <h1 className="text-2xl md:text-3xl font-extrabold leading-tight text-gray-900 dark:text-gray-100">
                {topic.title}
              </h1>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable answers region */}
      <div
        className="mt-2 overflow-auto max-h-[calc(100vh-140px)] pb-16 sm:pb-24"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4rem)' }}
      >
        {answers.length === 0 ? (
          <p className="text-gray-600">まだ回答が投稿されていません。</p>
        ) : (
          <ProgressiveAnswersList
            answers={answers}
            topicId={String(topic.id)}
          />
        )}
      </div>
    </div>
  );
}

function ProgressiveAnswersList({
  answers,
  topicId,
}: {
  answers: any[];
  topicId: string;
}) {
  const PAGE = 10;
  const [count, setCount] = useState(Math.min(PAGE, answers.length));
  const visible = answers.slice(0, count);
  return (
    <div>
      <ul className="space-y-5 px-1">
        {visible.map(a => (
          <AnswerCard key={a.id} answer={a} topicId={topicId} />
        ))}
      </ul>
      {count < answers.length ? (
        // add safe-area bottom padding so the button is reachable on devices with home indicator / footers
        <div
          className="mt-4 flex justify-center"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)',
          }}
        >
          <div className="w-full max-w-xs flex justify-center">
            <button
              className="px-4 py-2 rounded-md border bg-white dark:bg-gray-800 mb-4"
              onClick={() => setCount(c => Math.min(answers.length, c + PAGE))}
              aria-label={`もっと見る (${answers.length - count} 件)`}
            >
              もっと見る ({answers.length - count} 件)
            </button>
          </div>
        </div>
      ) : null}
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
      // prefer selected sub-user id so votes are attributed to sub-accounts
      const uid =
        localStorage.getItem('currentSubUserId') ??
        localStorage.getItem('currentUserId');
      if (!uid) return null;
      const k = `vote:answer:${answerId}:user:${uid}`;
      const v = localStorage.getItem(k);
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
    const isToggleOff = prev === level; // user clicked the same level -> remove vote

    // update counts locally first (optimistic)
    setCounts(c => {
      const next = { ...c };
      if (prev === 1) next.level1 = Math.max(0, next.level1 - 1);
      if (prev === 2) next.level2 = Math.max(0, next.level2 - 1);
      if (prev === 3) next.level3 = Math.max(0, next.level3 - 1);
      if (!isToggleOff) {
        if (level === 1) next.level1 = (next.level1 || 0) + 1;
        if (level === 2) next.level2 = (next.level2 || 0) + 1;
        if (level === 3) next.level3 = (next.level3 || 0) + 1;
      }
      return next;
    });

    try {
      const uid =
        localStorage.getItem('currentSubUserId') ||
        localStorage.getItem('currentUserId');
      if (!uid) {
        try {
          window.location.href = '/login';
        } catch {}
        return;
      }
      const k = `vote:answer:${answerId}:user:${uid}`;
      if (isToggleOff) {
        localStorage.removeItem(k);
      } else {
        localStorage.setItem(k, String(level));
      }
    } catch {}
    setSelection(isToggleOff ? null : level);

    // send vote (or removal) to server action so DB is updated
    (async () => {
      try {
        const form = new FormData();
        form.append('answerId', String(answerId));
        form.append('level', String(isToggleOff ? 0 : level)); // 0 means remove
        if (typeof prev === 'number')
          form.append('previousLevel', String(prev));
        const uid =
          localStorage.getItem('currentSubUserId') ||
          localStorage.getItem('currentUserId') ||
          '';
        form.append('userId', String(uid));

        const res = await fetch(window.location.pathname, {
          method: 'POST',
          body: form,
          headers: { Accept: 'application/json' },
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          // eslint-disable-next-line no-console
          console.error('vote submit failed', res.status, text);
          return;
        }

        const json = await res.json().catch(() => null);
        if (json && json.answer && json.answer.votes) {
          try {
            setCounts({
              level1: Number(json.answer.votes.level1 ?? 0),
              level2: Number(json.answer.votes.level2 ?? 0),
              level3: Number(json.answer.votes.level3 ?? 0),
            });
          } catch {}
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('vote submit error', e);
      }
    })();
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

// in-memory client cache for comments to avoid repeat fetches while the user navigates
const clientCommentsCache = new Map<string, any[]>();
// track in-flight comment fetches so parallel renders or re-entrancy reuse the same promise
const clientCommentsInFlight = new Map<string, Promise<any[]>>();

function AnswerCard({
  answer,
  comments,
  topicId,
}: {
  answer: any;
  comments?: Comment[];
  topicId?: string;
}) {
  const a = answer;
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  useEffect(() => {
    try {
      // prefer sub-user selection when present
      setCurrentUserId(
        localStorage.getItem('currentSubUserId') ??
          localStorage.getItem('currentUserId')
      );
      setCurrentUserName(
        localStorage.getItem('currentSubUserName') ??
          localStorage.getItem('currentUserName')
      );
    } catch {
      setCurrentUserId(null);
      setCurrentUserName(null);
    }
  }, []);
  const votes = a.votes ?? { level1: 0, level2: 0, level3: 0 };
  const [open, setOpen] = useState(false);
  const detailsId = `answer-details-${a.id}`;
  const [loadingComments, setLoadingComments] = useState(false);
  const [fetchedComments, setFetchedComments] = useState<Comment[] | null>(
    comments ?? null
  );
  // fetch function that deduplicates in-flight fetches and uses client cache
  const fetchCommentsOnce = async () => {
    const key = String(a.id);

    // prefer cache presence check (handles empty arrays too)
    if (clientCommentsCache.has(key)) {
      setFetchedComments(clientCommentsCache.get(key) ?? []);
      return;
    }

    // if another fetch is already running for this key, await it
    if (clientCommentsInFlight.has(key)) {
      try {
        const p = clientCommentsInFlight.get(key)!;
        const cs = await p;
        setFetchedComments(cs);
      } catch {
        setFetchedComments([]);
      }
      return;
    }

    let cancelled = false;
    setLoadingComments(true);

    const promise = (async () => {
      try {
        const res = await fetch(`/topics/${topicId}/comments/${a.id}`, {
          cache: 'no-cache',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return [] as Comment[];

        // Read as text first to avoid "body already read" when json() fails.
        let text: string | null = null;
        try {
          text = await res.text();
        } catch {
          text = null;
        }

        if (!text) return [] as Comment[];

        try {
          const parsed = JSON.parse(text);
          return (parsed && parsed.comments) || [];
        } catch {
          return [] as Comment[];
        }
      } catch {
        return [] as Comment[];
      }
    })();

    clientCommentsInFlight.set(key, promise);
    try {
      const cs = await promise;
      clientCommentsCache.set(key, cs);
      if (!cancelled) setFetchedComments(cs);
    } finally {
      clientCommentsInFlight.delete(key);
      if (!cancelled) setLoadingComments(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    // trigger fetch when opened (deduplicated by fetchCommentsOnce)
    fetchCommentsOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
            <div className="flex items-center gap-2">
              <FavoriteButton answerId={a.id} />
              <NumericVoteButtons answerId={a.id} initialVotes={votes} />
            </div>
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
            {/* comments: lazy-load only when user opens details */}
            <div className="mt-4">
              <h4 className="text-sm font-medium">コメント</h4>
              {loadingComments ? (
                <div className="text-sm text-gray-500">読み込み中…</div>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {(fetchedComments || []).map(c => (
                    <li key={c.id} className="text-gray-700">
                      {c.text}{' '}
                      <span className="text-xs text-gray-400">
                        — {c.author || '名無し'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3">
                <div className="text-muted mb-2">
                  コメントとして: {currentUserName ?? '名無し'}
                </div>
                <Form method="post" className="flex gap-2">
                  <input type="hidden" name="answerId" value={String(a.id)} />
                  <input
                    type="hidden"
                    name="authorId"
                    value={currentUserId ?? ''}
                  />
                  <input
                    type="hidden"
                    name="authorName"
                    value={currentUserName ?? ''}
                  />
                  <input
                    name="commentText"
                    className="form-input flex-1"
                    placeholder="コメントを追加"
                    aria-label="コメント入力"
                  />
                  <button className="btn-inline" aria-label="コメントを送信">
                    送信
                  </button>
                </Form>
              </div>
            </div>

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
