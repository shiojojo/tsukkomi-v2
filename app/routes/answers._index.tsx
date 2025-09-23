import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, Link, Form, useFetcher } from 'react-router';
import { useEffect, useState, useRef } from 'react';
// server-only imports are done inside loader/action to avoid bundling Supabase client in browser code
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { Comment } from '~/lib/schemas/comment';
import type { User } from '~/lib/schemas/user';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const q = params.get('q') ?? undefined;
  const author = params.get('author') ?? undefined;
  const page = Number(params.get('page') ?? '1');
  const pageSize = Number(params.get('pageSize') ?? '20');
  const sortBy = (params.get('sortBy') as any) ?? 'newest';
  const topicId = params.get('topicId') ?? undefined;
  const minScore = params.get('minScore')
    ? Number(params.get('minScore'))
    : undefined;
  const hasComments = params.get('hasComments')
    ? params.get('hasComments') === '1' || params.get('hasComments') === 'true'
    : undefined;
  const fromDate = params.get('fromDate') || undefined;
  const toDate = params.get('toDate') || undefined;

  const { getTopics, searchAnswers, getCommentsForAnswers, getUsers } =
    await import('~/lib/db');
  const topics = await getTopics();
  const topicsById = Object.fromEntries(topics.map(t => [String(t.id), t]));
  // Limit users fetched for the answers listing to avoid scanning the entire profiles table
  const users = await getUsers({ limit: 200 });

  const { answers, total } = await searchAnswers({
    q,
    topicId,
    page,
    pageSize,
    sortBy,
    minScore: Number.isNaN(minScore) ? undefined : minScore,
    hasComments: hasComments ?? false,
    fromDate,
    toDate,
    author,
  });
  const answerIds = answers.map(a => a.id);
  const commentsByAnswer = await getCommentsForAnswers(answerIds);

  return {
    answers,
    topicsById,
    commentsByAnswer,
    total,
    page,
    pageSize,
    users,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const answerId = form.get('answerId');
  const text = String(form.get('text') || '');
  // profileId must be supplied by the client (legacy author fields removed)
  const profileId = form.get('profileId')
    ? String(form.get('profileId'))
    : undefined;
  if (!answerId || !text) {
    return new Response('Invalid', { status: 400 });
  }
  if (!profileId) {
    return new Response('Missing profileId', { status: 400 });
  }
  const { addComment } = await import('~/lib/db');
  try {
    await addComment({
      answerId: String(answerId),
      text,
      profileId,
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    // log incoming form for debugging
    try {
      const entries: Record<string, any> = {};
      for (const [k, v] of form.entries()) entries[k] = String(v);
      // eslint-disable-next-line no-console
      console.error('addComment failed', {
        entries,
        err: String(e?.message ?? e),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        'addComment failed (serialize error)',
        String(e?.message ?? e)
      );
    }
    return new Response(
      JSON.stringify({ ok: false, error: String(e?.message ?? e) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export default function AnswersRoute() {
  type LoaderData = Awaited<ReturnType<typeof loader>>;
  const data = useLoaderData() as LoaderData;
  const answers: Answer[] = data?.answers ?? [];
  const topicsById: Record<string, Topic> = (data as any)?.topicsById ?? {};
  const commentsByAnswer: Record<string, Comment[]> =
    (data as any)?.commentsByAnswer ?? {};
  const users: User[] = (data as any)?.users ?? [];
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
        className={`p-2 rounded-md ${favLocal ? 'text-red-500' : 'text-gray-400 dark:text-white'} hover:opacity-90`}
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
              topic.image ? (
                <div className="block p-0 border rounded-md overflow-hidden">
                  <div className="w-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                    <img
                      src={topic.image}
                      alt={topic.title}
                      className="w-full h-auto max-h-40 object-contain"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-lg md:text-xl font-extrabold text-gray-900 dark:text-gray-100">
                  {topic.title}
                </div>
              )
            ) : (
              <div className="text-lg md:text-xl font-extrabold">
                お題なし（フリー回答）
              </div>
            )}
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <p className="text-lg leading-snug break-words">{a.text}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-white">
                <span className="inline-flex items-center gap-1 font-medium text-gray-700 dark:text-white">
                  Score:{' '}
                  <span className="text-gray-900 dark:text-gray-100">
                    {score}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1">
                  👍1:{(a as any).votes?.level1 ?? 0}
                </span>
                <span className="inline-flex items-center gap-1">
                  😂2:{(a as any).votes?.level2 ?? 0}
                </span>
                <span className="inline-flex items-center gap-1">
                  🤣3:{(a as any).votes?.level3 ?? 0}
                </span>
                {a.author && (
                  <span className="inline-flex items-center gap-1">
                    作者: {a.author}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 min-w-[64px]">
              <button
                type="button"
                onClick={() => setOpen(s => !s)}
                aria-expanded={open}
                className="text-xs px-2 py-1 rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                {open ? '閉じる' : '詳細'}
              </button>
              <FavoriteButton answerId={a.id} />
            </div>
          </div>

          {open && (
            <div className="mt-3">
              <h4 className="text-sm font-medium">コメント</h4>
              <ul className="mt-2 space-y-2 text-sm">
                {(commentsByAnswer[String(a.id)] || []).map(c => (
                  <li key={c.id} className="text-gray-700 dark:text-white">
                    {c.text}{' '}
                    <span className="text-xs text-gray-400 dark:text-white">
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
                    name="profileId"
                    value={currentUserId ?? ''}
                  />
                  {/* authorName removed: profileId is authoritative identity for comments */}
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

  // Filter UI state (server-driven via GET form)
  const [query, setQuery] = useState('');
  const [authorQuery, setAuthorQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'scoreDesc'>(
    'newest'
  );
  const [minScore, setMinScore] = useState<string>('');
  const [hasComments, setHasComments] = useState<boolean>(false);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] =
    useState<boolean>(false);

  // ref to the scrollable answers container so we can scroll to top on page change
  const answersContainerRef = useRef<HTMLDivElement | null>(null);

  // initialize from current URL so form inputs reflect current server filters
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      setQuery(params.get('q') ?? '');
      setAuthorQuery(params.get('author') ?? '');
      setSortBy((params.get('sortBy') as any) ?? 'newest');
      setMinScore(params.get('minScore') ?? '');
      setHasComments(
        params.get('hasComments') === '1' ||
          params.get('hasComments') === 'true'
      );
      setFromDate(params.get('fromDate') ?? '');
      setToDate(params.get('toDate') ?? '');
    } catch {}
  }, []);

  // helper: compute a numeric score from votes object
  const computeScore = (a: Answer) => {
    const v = (a as any).votes || { level1: 0, level2: 0, level3: 0 };
    const l1 = Number(v.level1 || 0);
    const l2 = Number(v.level2 || 0);
    const l3 = Number(v.level3 || 0);
    // weighted score: 1*level1 + 2*level2 + 3*level3
    return l1 * 1 + l2 * 2 + l3 * 3;
  };

  // helpers to adjust minScore in UI (mobile-friendly increment/decrement)
  const incrementMinScore = () => {
    const n = Number(minScore || 0);
    setMinScore(String(n + 1));
  };
  const decrementMinScore = () => {
    const n = Math.max(0, Number(minScore || 0) - 1);
    setMinScore(String(n));
  };

  // reset all filters to defaults and reload the route (clears query params)
  const resetFilters = () => {
    try {
      setQuery('');
      setAuthorQuery('');
      setSortBy('newest');
      setMinScore('');
      setHasComments(false);
      setFromDate('');
      setToDate('');
      // reload without query params so loader receives defaults
      window.location.href = window.location.pathname;
    } catch {}
  };

  // Persist advanced filters visibility so it doesn't unexpectedly close on reloads
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('showAdvancedFilters');
      if (p === '1') {
        setShowAdvancedFilters(true);
      } else {
        const v = localStorage.getItem('answers:showAdvancedFilters');
        if (v === '1') setShowAdvancedFilters(true);
      }
    } catch {}
  }, []);

  const toggleAdvancedFilters = () => {
    setShowAdvancedFilters(s => {
      const next = !s;
      try {
        localStorage.setItem('answers:showAdvancedFilters', next ? '1' : '0');
        // also persist to URL so GET navigations keep the setting
        try {
          const url = new URL(window.location.href);
          if (next) url.searchParams.set('showAdvancedFilters', '1');
          else url.searchParams.delete('showAdvancedFilters');
          history.replaceState(null, '', url.toString());
        } catch {}
      } catch {}
      return next;
    });
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

  // Server-driven pagination: answers returned by the loader are already paged
  const serverPage = (data as any)?.page ?? 1;
  const serverPageSize = (data as any)?.pageSize ?? 20;
  const total = (data as any)?.total ?? answers.length;
  const pageCount = Math.max(1, Math.ceil(total / serverPageSize));
  const currentPage = Math.min(Math.max(1, serverPage), pageCount);
  const paged = answers.map(a => ({ answer: a, score: computeScore(a) }));

  // Scroll to top of the answers container when page changes (client-side navigation)
  useEffect(() => {
    try {
      if (!answersContainerRef.current) return;
      // jump to top immediately
      answersContainerRef.current.scrollTo({ top: 0 });
    } catch {}
  }, [currentPage]);

  // helper to build href preserving current filters (used by mobile & desktop)
  const buildHref = (p: number) => {
    const parts: string[] = [];
    if (query) parts.push(`q=${encodeURIComponent(query)}`);
    if (authorQuery) parts.push(`author=${encodeURIComponent(authorQuery)}`);
    parts.push(`sortBy=${encodeURIComponent(String(sortBy))}`);
    parts.push(`page=${p}`);
    if (minScore)
      parts.push(`minScore=${encodeURIComponent(String(minScore))}`);
    if (hasComments) parts.push('hasComments=1');
    if (fromDate) parts.push(`fromDate=${encodeURIComponent(fromDate)}`);
    if (toDate) parts.push(`toDate=${encodeURIComponent(toDate)}`);
    return `?${parts.join('&')}`;
  };

  return (
    <div
      style={{ paddingTop: 'var(--app-header-height, 0px)' }}
      className="p-4 pb-24 md:pb-4 max-w-3xl mx-auto flex flex-col"
    >
      <div className="sticky top-0 md:top-16 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">大喜利 - 回答一覧</h1>
            </div>
            {/* removed link to /topics per UX: not needed on search screen */}
          </div>

          {/* Filters: search and sort (server-driven via GET) */}
          <div className="mt-3">
            <Form
              method="get"
              className="flex flex-wrap gap-2 items-start md:items-center"
            >
              {/* q (text search) moved to advanced filters */}

              {/* Group: author, sortBy, advanced toggle — keep single-line on small screens */}
              <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-white mb-1 block">
                      作者
                    </label>
                    <select
                      name="author"
                      value={authorQuery}
                      onChange={e => setAuthorQuery(e.target.value)}
                      className="form-select w-28 md:w-44"
                    >
                      <option value="">全て</option>
                      {users.map(u => (
                        <option key={u.id} value={u.name}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {authorQuery && (
                    <button
                      type="button"
                      className="text-sm text-red-500"
                      onClick={() => setAuthorQuery('')}
                    >
                      クリア
                    </button>
                  )}
                </div>

                <div className="flex-shrink-0">
                  <select
                    name="sortBy"
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                    className="form-select w-20 md:w-32"
                  >
                    <option value="newest">新着</option>
                    <option value="oldest">古い順</option>
                    <option value="scoreDesc">スコア順</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    className="text-sm px-2 py-1 border rounded-md"
                    onClick={toggleAdvancedFilters}
                  >
                    {showAdvancedFilters ? '詳細を閉じる' : '詳細フィルタ'}
                  </button>
                </div>
              </div>

              {showAdvancedFilters && (
                <div className="flex flex-col gap-3 w-full mt-2">
                  <div className="w-full">
                    <label className="text-xs text-gray-500 dark:text-white mb-1 block">
                      お題タイトル
                    </label>
                    <input
                      name="q"
                      type="search"
                      placeholder="飲み"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      className="form-input w-full"
                      aria-label="お題タイトル検索"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={decrementMinScore}
                        className="px-2 py-1 border rounded"
                      >
                        -
                      </button>
                      <input
                        name="minScore"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min={0}
                        placeholder="min score"
                        value={minScore}
                        onChange={e =>
                          setMinScore(e.target.value.replace(/[^0-9]/g, ''))
                        }
                        className="form-input w-20 text-center"
                      />
                      <button
                        type="button"
                        onClick={incrementMinScore}
                        className="px-2 py-1 border rounded"
                      >
                        +
                      </button>
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        name="hasComments"
                        type="checkbox"
                        checked={hasComments}
                        onChange={e => setHasComments(e.target.checked)}
                        value="1"
                        className="w-4 h-4"
                      />
                      <span className="text-sm">has comments</span>
                    </label>
                  </div>

                  <div className="w-full flex items-center gap-4">
                    <div className="flex-1 flex flex-col">
                      <label className="text-xs text-gray-500 dark:text-white mb-1">
                        開始日
                      </label>
                      <input
                        name="fromDate"
                        type="date"
                        value={fromDate}
                        onChange={e => setFromDate(e.target.value)}
                        className="form-input w-full"
                        aria-label="開始日"
                      />
                    </div>

                    <div className="flex-1 flex flex-col">
                      <label className="text-xs text-gray-500 dark:text-white mb-1">
                        終了日
                      </label>
                      <input
                        name="toDate"
                        type="date"
                        value={toDate}
                        onChange={e => setToDate(e.target.value)}
                        className="form-input w-full"
                        aria-label="終了日"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button type="submit" className="btn-inline">
                  検索
                </button>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-sm px-2 py-1 border rounded-md text-gray-600 dark:text-white"
                >
                  リセット
                </button>
              </div>
            </Form>
            {/* Mobile hint: collapse into two rows automatically via flex-wrap */}
          </div>
        </div>
      </div>

      {/* Scrollable answers container.
          - On small screens we subtract space for the header + bottom nav (~56px each => 112px).
          - On md+ we subtract the top nav (approx 64px). These are reasonable assumptions based on the app's nav sizes.
        */}
      <div
        ref={answersContainerRef}
        className="overflow-auto px-0 py-4 space-y-4 w-full max-h-[calc(100vh-112px)] md:max-h-[calc(100vh-64px)]"
      >
        {paged.length === 0 ? (
          <p className="text-gray-600 dark:text-white px-4">
            表示される回答がありません。
          </p>
        ) : (
          <div className="space-y-8 px-4">
            {/* Render answers in the exact order returned by the loader (preserve DB ordering) */}
            <ul className="space-y-4">
              {paged.map(({ answer: a, score }) => (
                <AnswerCard key={a.id} a={a} score={score} />
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Mobile pagination controls (link-based) */}
      <div className="flex items-center justify-between mt-4 md:hidden px-4">
        <Link
          to={buildHref(Math.max(1, currentPage - 1))}
          aria-label="前のページ"
          className={`px-3 py-2 rounded-md border ${currentPage <= 1 ? 'opacity-40 pointer-events-none' : 'bg-white'}`}
        >
          前へ
        </Link>

        <div className="text-sm">{`ページ ${currentPage} / ${pageCount}`}</div>

        <Link
          to={buildHref(Math.min(pageCount, currentPage + 1))}
          aria-label="次のページ"
          className={`px-3 py-2 rounded-md border ${currentPage >= pageCount ? 'opacity-40 pointer-events-none' : 'bg-white'}`}
        >
          次へ
        </Link>
      </div>
      {/* Desktop pagination controls (visible on md+). Mirrors mobile but shows numeric page links. */}
      <div className="hidden md:flex items-center justify-center mt-4 px-4 gap-2">
        {/** build href preserving current filters */}
        {(() => {
          const buildHref = (p: number) => {
            const parts: string[] = [];
            if (query) parts.push(`q=${encodeURIComponent(query)}`);
            if (authorQuery)
              parts.push(`author=${encodeURIComponent(authorQuery)}`);
            parts.push(`sortBy=${encodeURIComponent(String(sortBy))}`);
            parts.push(`page=${p}`);
            if (minScore)
              parts.push(`minScore=${encodeURIComponent(String(minScore))}`);
            if (hasComments) parts.push('hasComments=1');
            if (fromDate)
              parts.push(`fromDate=${encodeURIComponent(fromDate)}`);
            if (toDate) parts.push(`toDate=${encodeURIComponent(toDate)}`);
            return `?${parts.join('&')}`;
          };

          const windowSize = 3; // pages to show on each side of current
          const start = Math.max(1, currentPage - windowSize);
          const end = Math.min(pageCount, currentPage + windowSize);

          return (
            <nav
              aria-label="ページネーション"
              className="flex items-center gap-2"
            >
              <Link
                to={buildHref(Math.max(1, currentPage - 1))}
                aria-label="前のページ"
                className={`px-3 py-2 rounded-md border ${currentPage <= 1 ? 'opacity-40 pointer-events-none' : 'bg-white'}`}
              >
                前へ
              </Link>

              <div className="flex items-center gap-1">
                {start > 1 && (
                  <>
                    <Link
                      to={buildHref(1)}
                      className="px-2 py-1 rounded-md border bg-white"
                    >
                      1
                    </Link>
                    {start > 2 && <span className="px-2">…</span>}
                  </>
                )}

                {Array.from(
                  { length: end - start + 1 },
                  (_, i) => start + i
                ).map(p => (
                  <Link
                    key={p}
                    to={buildHref(p)}
                    aria-current={p === currentPage ? 'page' : undefined}
                    className={`px-3 py-2 rounded-md border ${p === currentPage ? 'bg-blue-600 text-white' : 'bg-white'}`}
                  >
                    {p}
                  </Link>
                ))}

                {end < pageCount && (
                  <>
                    {end < pageCount - 1 && <span className="px-2">…</span>}
                    <Link
                      to={buildHref(pageCount)}
                      className="px-2 py-1 rounded-md border bg-white"
                    >
                      {pageCount}
                    </Link>
                  </>
                )}
              </div>

              <Link
                to={buildHref(Math.min(pageCount, currentPage + 1))}
                aria-label="次のページ"
                className={`px-3 py-2 rounded-md border ${currentPage >= pageCount ? 'opacity-40 pointer-events-none' : 'bg-white'}`}
              >
                次へ
              </Link>
            </nav>
          );
        })()}
      </div>
    </div>
  );
}
