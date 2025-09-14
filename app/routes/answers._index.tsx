import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, Link, Form, useFetcher } from 'react-router';
import { useEffect, useState } from 'react';
import { getAnswers, getTopics } from '~/lib/db';
import { getCommentsByAnswer, addComment } from '~/lib/db';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { Comment } from '~/lib/schemas/comment';

export async function loader({ request }: LoaderFunctionArgs) {
  const topics = await getTopics();
  const topicsById = Object.fromEntries(topics.map(t => [String(t.id), t]));
  const answers = await getAnswers();
  // collect comments per-answer in dev
  const commentsByAnswer: Record<string, Comment[]> = {};
  for (const a of answers) {
    const comments = await getCommentsByAnswer(a.id);
    commentsByAnswer[String(a.id)] = comments;
  }

  return { answers, topicsById, commentsByAnswer };
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const answerId = form.get('answerId');
  const text = String(form.get('text') || '');
  const authorId = form.get('authorId')
    ? String(form.get('authorId'))
    : undefined;
  const authorName = form.get('authorName')
    ? String(form.get('authorName'))
    : undefined;
  if (!answerId || !text) {
    return { ok: false };
  }
  await addComment({
    answerId: String(answerId),
    text,
    author: authorName,
    authorId,
  });
  return { ok: true };
}

export default function AnswersRoute() {
  type LoaderData = Awaited<ReturnType<typeof loader>>;
  const data = useLoaderData() as LoaderData;
  const answers: Answer[] = data?.answers ?? [];
  const topicsById: Record<string, Topic> = (data as any)?.topicsById ?? {};
  const commentsByAnswer: Record<string, Comment[]> =
    (data as any)?.commentsByAnswer ?? {};
  // No pinned topic handling: topics are shown per-answer and topic-specific pages live under /topics/:id

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  useEffect(() => {
    try {
      // prefer selected sub-user identity when available
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

  // Local FavoriteButton (user-scoped) — mirrors behavior used elsewhere
  function FavoriteButton({ answerId }: { answerId: number }) {
    const [currentUserIdLocal, setCurrentUserIdLocal] = useState<string | null>(
      null
    );
    const [favLocal, setFavLocal] = useState<boolean>(false);

    useEffect(() => {
      try {
        // prefer selected sub-user identity when available so favorites are stored per-subuser
        const uid =
          localStorage.getItem('currentSubUserId') ??
          localStorage.getItem('currentUserId');
        setCurrentUserIdLocal(uid);
        if (uid) {
          const key = `favorite:answer:${answerId}:user:${uid}`;
          setFavLocal(localStorage.getItem(key) === '1');
        }
      } catch {
        setCurrentUserIdLocal(null);
        setFavLocal(false);
      }
    }, [answerId]);

    useEffect(() => {
      try {
        if (!currentUserIdLocal) return;
        const key = `favorite:answer:${answerId}:user:${currentUserIdLocal}`;
        localStorage.setItem(key, favLocal ? '1' : '0');
      } catch {}
    }, [favLocal, answerId, currentUserIdLocal]);

    const handleClick = () => {
      if (!currentUserIdLocal) {
        try {
          window.location.href = '/login';
        } catch {}
        return;
      }
      setFavLocal(s => !s);
    };

    return (
      <button
        type="button"
        aria-pressed={favLocal}
        onClick={handleClick}
        className={`p-2 rounded-md ${favLocal ? 'text-red-500' : 'text-gray-400'} hover:opacity-90`}
        title={
          !currentUserIdLocal
            ? 'ログインしてお気に入り登録'
            : favLocal
              ? 'お気に入り解除'
              : 'お気に入り'
        }
      >
        {favLocal ? (
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

  // Per-answer card with topic header and expandable details (comments + form)
  function AnswerCard({ a, score }: { a: Answer; score: number }) {
    const [open, setOpen] = useState(false);
    const topic = a.topicId ? topicsById[String(a.topicId)] : null;

    return (
      <li
        key={a.id}
        className="p-4 border rounded-md bg-white/80 dark:bg-gray-950/80"
      >
        <div className="flex flex-col gap-3">
          {/* Topic shown at top of the card, large and unabbreviated */}
          <div>
            {topic ? (
              <div className="text-lg md:text-xl font-extrabold text-gray-900 dark:text-gray-100">
                {topic.title}
              </div>
            ) : (
              <div className="text-lg md:text-xl font-extrabold">
                お題なし（フリー回答）
              </div>
            )}
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="mt-2 text-lg">{a.text}</p>
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={() => setOpen(s => !s)}
                aria-expanded={open}
                className="text-sm text-blue-600 px-2 py-1 rounded-md"
              >
                {open ? '閉じる' : '詳細'}
              </button>
            </div>
          </div>

          {open && (
            <div className="mt-3">
              <h4 className="text-sm font-medium">コメント</h4>
              <ul className="mt-2 space-y-2 text-sm">
                {(commentsByAnswer[String(a.id)] || []).map(c => (
                  <li key={c.id} className="text-gray-700">
                    {c.text}{' '}
                    <span className="text-xs text-gray-400">
                      — {c.author || '名無し'}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-3">
                <div className="text-muted mb-2">
                  コメントとして: {currentUserName ?? '名無し'}
                </div>
                <Form method="post" className="flex gap-2" replace>
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
                    name="text"
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
          )}
        </div>
      </li>
    );
  }

  // Filter UI state (client-side filtering)
  const [query, setQuery] = useState('');
  const [minScore, setMinScore] = useState<number | ''>('');
  const [hasComments, setHasComments] = useState(false);
  const [onlyFavorited, setOnlyFavorited] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'scoreDesc'>(
    'newest'
  );

  // helper: compute a numeric score from votes object
  const computeScore = (a: Answer) => {
    const v = (a as any).votes || { level1: 0, level2: 0, level3: 0 };
    const l1 = Number(v.level1 || 0);
    const l2 = Number(v.level2 || 0);
    const l3 = Number(v.level3 || 0);
    // weighted score: 1*level1 + 2*level2 + 3*level3
    return l1 * 1 + l2 * 2 + l3 * 3;
  };

  // helper: whether answer is favorited by current user (localStorage)
  const isFavoritedByCurrentUser = (answer: Answer) => {
    if (!currentUserId) return false;
    try {
      const key = `favorite:answer:${answer.id}:user:${currentUserId}`;
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  };

  // memoized filtered list
  const filtered = answers
    .map(a => ({ answer: a, score: computeScore(a) }))
    .filter(({ answer, score }) => {
      // text query (in answer text or author)
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        if (
          !String(answer.text).toLowerCase().includes(q) &&
          !String(answer.author || '')
            .toLowerCase()
            .includes(q)
        )
          return false;
      }
      // minScore
      if (minScore !== '' && score < Number(minScore)) return false;
      // hasComments
      if (hasComments) {
        const cs = commentsByAnswer[String(answer.id)] || [];
        if (cs.length === 0) return false;
      }
      // favorited
      if (onlyFavorited) {
        if (!isFavoritedByCurrentUser(answer)) return false;
      }
      // date range
      if (dateFrom) {
        const from = new Date(dateFrom + 'T00:00:00');
        if (new Date(answer.created_at) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo + 'T23:59:59');
        if (new Date(answer.created_at) > to) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'newest')
        return (
          new Date(b.answer.created_at).getTime() -
          new Date(a.answer.created_at).getTime()
        );
      if (sortBy === 'oldest')
        return (
          new Date(a.answer.created_at).getTime() -
          new Date(b.answer.created_at).getTime()
        );
      // scoreDesc
      return b.score - a.score;
    });

  // Pagination (mobile-first)
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  // reset page when any filter changes
  useEffect(() => {
    setPage(1);
  }, [query, minScore, hasComments, onlyFavorited, dateFrom, dateTo, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const paged = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <div className="p-4 pb-24 md:pb-4 max-w-3xl mx-auto flex flex-col">
      <div className="sticky top-0 md:top-16 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">大喜利 - 回答一覧</h1>
            </div>
            {/* removed link to /topics per UX: not needed on search screen */}
          </div>

          {/* Filters: search, min score, comments, favorited, date range, sort */}
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
            <input
              type="search"
              placeholder="検索: テキスト or 作者"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="form-input w-full"
              aria-label="回答検索"
            />

            <div className="flex gap-2 items-center">
              <input
                type="number"
                placeholder="最小スコア"
                value={minScore === '' ? '' : String(minScore)}
                onChange={e =>
                  setMinScore(
                    e.target.value === '' ? '' : Number(e.target.value)
                  )
                }
                className="form-input w-28"
                aria-label="最小スコア"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasComments}
                  onChange={e => setHasComments(e.target.checked)}
                />
                コメントあり
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={onlyFavorited}
                  onChange={e => setOnlyFavorited(e.target.checked)}
                />
                お気に入り
              </label>
            </div>

            <div className="flex flex-wrap gap-2 items-center justify-end">
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="form-input w-32"
              />
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="form-input w-32"
              />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="form-select w-36"
              >
                <option value="newest">新着</option>
                <option value="oldest">古い順</option>
                <option value="scoreDesc">スコア順</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable answers container.
          - On small screens we subtract space for the header + bottom nav (~56px each => 112px).
          - On md+ we subtract the top nav (approx 64px). These are reasonable assumptions based on the app's nav sizes.
        */}
      <div className="overflow-auto px-0 py-4 space-y-4 w-full max-h-[calc(100vh-112px)] md:max-h-[calc(100vh-64px)]">
        {filtered.length === 0 ? (
          <p className="text-gray-600 px-4">表示される回答がありません。</p>
        ) : (
          <div className="space-y-8 px-4">
            {
              // Group answers by topicId so the topic title appears above its answers
              Object.values(
                paged.reduce(
                  (acc, { answer, score }) => {
                    const tid = answer.topicId ?? null;
                    const key = tid === null ? 'none' : String(tid);
                    if (!acc[key])
                      acc[key] = {
                        topicId: tid === null ? null : Number(tid),
                        items: [] as { answer: Answer; score: number }[],
                      };
                    acc[key].items.push({ answer, score });
                    return acc;
                  },
                  {} as Record<
                    string,
                    {
                      topicId: number | null;
                      items: { answer: Answer; score: number }[];
                    }
                  >
                )
              ).map(group => (
                <section key={String(group.topicId ?? 'none')} className="">
                  <ul className="space-y-4">
                    {group.items.map(({ answer: a, score }) => (
                      <AnswerCard key={a.id} a={a} score={score} />
                    ))}
                  </ul>
                </section>
              ))
            }
          </div>
        )}
      </div>

      {/* Mobile pagination controls */}
      <div className="flex items-center justify-between mt-4 md:hidden px-4">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          aria-label="前のページ"
          className={`px-3 py-2 rounded-md border ${currentPage <= 1 ? 'opacity-40 pointer-events-none' : 'bg-white'}`}
        >
          前へ
        </button>

        <div className="text-sm">{`ページ ${currentPage} / ${pageCount}`}</div>

        <button
          onClick={() => setPage(p => Math.min(pageCount, p + 1))}
          disabled={currentPage >= pageCount}
          aria-label="次のページ"
          className={`px-3 py-2 rounded-md border ${currentPage >= pageCount ? 'opacity-40 pointer-events-none' : 'bg-white'}`}
        >
          次へ
        </button>
      </div>
    </div>
  );
}
