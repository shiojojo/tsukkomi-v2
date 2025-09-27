import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, Link, Form } from 'react-router';
import { useEffect, useState, useRef } from 'react';
import StickyHeaderLayout from '~/components/StickyHeaderLayout';
import AnswerActionCard from '~/components/AnswerActionCard';
import { useAnswerUserData } from '~/hooks/useAnswerUserData';
// server-only imports are done inside loader/action to avoid bundling Supabase client in browser code
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { Comment } from '~/lib/schemas/comment';
import type { User } from '~/lib/schemas/user';
import { logger } from '~/lib/logger';

// Simple in-memory guard to suppress very short-window duplicate POSTs.
// Keyed by `${op}:${profileId}:${answerId}` and stores last timestamp (ms).
// This is intentionally simple (in-memory) and exists to mitigate accidental
// client-side storms while a proper fix (client batching / server rate-limit)
// is implemented. It may be reset on server restart.
const _recentPostGuard = new Map<string, number>();

import { consumeToken } from '~/lib/rateLimiter';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const profileIdQuery = params.get('profileId') ?? undefined;
  const q = params.get('q') ?? undefined;
  const author = params.get('authorName') ?? undefined;
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
    profileId: profileIdQuery,
  });
  const answerIds = answers.map(a => a.id);
  const commentsByAnswer = await getCommentsForAnswers(answerIds);
  // favorite counts for answers (DB-backed)
  try {
    const { getFavoriteCounts, getFavoritesForProfile } = await import(
      '~/lib/db'
    );
    const favCounts = await getFavoriteCounts(answerIds);
    // attach counts onto answers (non-destructive)
    for (const a of answers) {
      (a as any).favCount = favCounts[Number(a.id)] ?? 0;
    }
    // if request includes a profile id via query (not typical), attempt to fetch which are favorited
    if (profileIdQuery) {
      try {
        const favs = await getFavoritesForProfile(profileIdQuery, answerIds);
        const favSet = new Set((favs || []).map(v => Number(v)));
        for (const a of answers) {
          (a as any).favorited = favSet.has(Number(a.id));
        }
      } catch {}
    }
  } catch (err) {}

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
  // Throttled lightweight instrumentation to help diagnose noisy clients.
  try {
    const anyKey = Array.from(form.keys())[0];
    const now = Date.now();
    (globalThis as any).__answersActionLastLog =
      (globalThis as any).__answersActionLastLog || 0;
    if (now - (globalThis as any).__answersActionLastLog > 2000) {
      (globalThis as any).__answersActionLastLog = now;
      // eslint-disable-next-line no-console
      logger.debug(
        'answers.action inbound keys',
        anyKey ? [...form.keys()] : []
      );
    }
  } catch {}

  const op = form.get('op') ? String(form.get('op')) : undefined; // 'toggle' | 'status'
  const answerIdRaw = form.get('answerId');
  const commentTextRaw = form.get('text');
  const levelRaw = form.get('level');
  const hasMeaningfulIntent =
    op === 'toggle' ||
    op === 'status' ||
    levelRaw != null ||
    (answerIdRaw && commentTextRaw);

  // If the POST contains no recognized fields, treat as benign noise and return 204 (no content)
  if (!hasMeaningfulIntent) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 204,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // build a rate limit key only for meaningful intents
  let rateKey = 'anon';
  try {
    const profileIdCandidate = form.get('profileId')
      ? String(form.get('profileId'))
      : undefined;
    if (profileIdCandidate) rateKey = `p:${profileIdCandidate}`;
    else {
      try {
        const hdr =
          request.headers && request.headers.get
            ? request.headers.get('x-forwarded-for') ||
              request.headers.get('x-real-ip')
            : null;
        if (hdr) rateKey = `ip:${String(hdr).split(',')[0].trim()}`;
      } catch {}
    }
  } catch {}
  if (!consumeToken(rateKey, 1)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Too Many Requests', rateKey }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // support favorite toggle ops
  if (op === 'toggle') {
    const answerId = form.get('answerId');
    const profileId = form.get('profileId')
      ? String(form.get('profileId'))
      : undefined;
    // duplicate suppression: ignore identical requests within short window
    try {
      const key = `toggle:${String(profileId)}:${String(answerId)}`;
      const now = Date.now();
      const prev = _recentPostGuard.get(key) ?? 0;
      if (now - prev < 800) {
        // treat as no-op success to avoid client confusion
        return new Response(JSON.stringify({ ok: true, deduped: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      _recentPostGuard.set(key, now);
    } catch {}
    // debug: log incoming toggle request
    try {
      const entries: Record<string, any> = {};
      for (const [k, v] of form.entries()) entries[k] = String(v);
      // eslint-disable-next-line no-console
      logger.log('action.toggleFavorite request', entries);
    } catch {}
    if (!answerId || !profileId)
      return new Response('Invalid', { status: 400 });
    const { toggleFavorite } = await import('~/lib/db');
    try {
      const res = await toggleFavorite({
        answerId: Number(answerId),
        profileId,
      });
      return new Response(JSON.stringify(res), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      // log server-side error for debugging
      try {
        // eslint-disable-next-line no-console
        console.error('toggleFavorite failed', String(e?.message ?? e));
      } catch {}
      return new Response(
        JSON.stringify({ ok: false, error: String(e?.message ?? e) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
  // support favorite status query (non-mutating) for client to ask whether a profile favorited an answer
  if (op === 'status') {
    const answerId = form.get('answerId');
    const profileId = form.get('profileId')
      ? String(form.get('profileId'))
      : undefined;
    // duplicate suppression for status checks as well
    try {
      const key = `status:${String(profileId)}:${String(answerId)}`;
      const now = Date.now();
      const prev = _recentPostGuard.get(key) ?? 0;
      if (now - prev < 800) {
        return new Response(
          JSON.stringify({ favorited: false, deduped: true }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      _recentPostGuard.set(key, now);
    } catch {}
    if (!answerId || !profileId)
      return new Response('Invalid', { status: 400 });
    const { getFavoritesForProfile } = await import('~/lib/db');
    try {
      const list = await getFavoritesForProfile(profileId, [Number(answerId)]);
      const favorited = (list || []).map(Number).includes(Number(answerId));
      return new Response(JSON.stringify({ favorited }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      return new Response(
        JSON.stringify({ ok: false, error: String(e?.message ?? e) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
  if (levelRaw != null) {
    const answerId = Number(form.get('answerId'));
    const userId = form.get('userId') ? String(form.get('userId')) : undefined;
    const previousLevel = form.get('previousLevel')
      ? Number(form.get('previousLevel'))
      : undefined;
    const levelParsed = Number(levelRaw);
    const level = levelParsed === 0 ? 0 : (levelParsed as 1 | 2 | 3);
    if (!answerId || !userId || level == null) {
      return new Response('Invalid vote', { status: 400 });
    }
    const { voteAnswer } = await import('~/lib/db');
    const updated = await voteAnswer({
      answerId,
      level,
      previousLevel,
      userId,
    });
    return new Response(JSON.stringify({ answer: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
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
  const usersById = Object.fromEntries(users.map(u => [String(u.id), u]));
  const getNameByProfileId = (pid?: string | null) => {
    if (!pid) return undefined;
    const found = usersById[String(pid)];
    return found ? found.name : undefined;
  };

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  // Client-side user data sync for answers
  const answerIds = answers.map(a => a.id);
  const { data: userAnswerData, markFavorite } = useAnswerUserData(answerIds);

  useEffect(() => {
    try {
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
      setAuthorQuery(params.get('authorName') ?? '');
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
  const paged = answers;

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
    if (authorQuery)
      parts.push(`authorName=${encodeURIComponent(authorQuery)}`);
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
    <StickyHeaderLayout
      header={
        <div className="z-30 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
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
                        name="authorName"
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
      }
      contentRef={answersContainerRef}
    >
      {/* Scrollable answers container. The scroll container is provided by StickyHeaderLayout */}
      <div className="px-0 py-4 space-y-4 w-full">
        {paged.length === 0 ? (
          <p className="text-gray-600 dark:text-white px-4">
            表示される回答がありません。
          </p>
        ) : (
          <div className="space-y-8 px-4">
            {/* Render answers in the exact order returned by the loader (preserve DB ordering) */}
            <ul className="space-y-4">
              {paged.map(answer => (
                <AnswerActionCard
                  key={answer.id}
                  answer={answer}
                  topic={
                    answer.topicId ? topicsById[String(answer.topicId)] : null
                  }
                  comments={commentsByAnswer[String(answer.id)] || []}
                  getNameByProfileId={getNameByProfileId}
                  currentUserName={currentUserName}
                  currentUserId={currentUserId}
                  userAnswerData={userAnswerData}
                  onFavoriteUpdate={markFavorite}
                  actionPath="/answers"
                />
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
              parts.push(`authorName=${encodeURIComponent(authorQuery)}`);
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
    </StickyHeaderLayout>
  );
}
