import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, Link, Form } from 'react-router';
import { useEffect, useMemo, useState, useRef } from 'react';
import StickyHeaderLayout from '~/components/StickyHeaderLayout';
import { AnswersList } from '~/components/AnswersList';
import { Pagination } from '~/components/Pagination';
import { DateRangeFilter } from '~/components/DateRangeFilter';
import { SearchInput } from '~/components/SearchInput';
import { useAnswerUserData } from '~/hooks/useAnswerUserData';
import { useIdentity } from '~/hooks/useIdentity';
import { useNameByProfileId } from '~/hooks/useNameByProfileId';
import { FilterForm } from '~/components/FilterForm';
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

  const {
    getTopics,
    searchAnswers,
    getCommentsForAnswers,
    getUsers,
    getUserAnswerData,
  } = await import('~/lib/db');
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

  // Get user-specific data if profileId provided
  let userAnswerData: {
    votes: Record<number, number>;
    favorites: Set<number>;
  } = { votes: {}, favorites: new Set<number>() };
  if (profileIdQuery) {
    userAnswerData = await getUserAnswerData(profileIdQuery, answerIds);
  }

  // Merge user data into answers
  const answersWithUserData = answers.map(a => {
    const embeddedVotes = ((a as any).votesBy ?? {}) as Record<string, number>;
    const mergedVotesBy = { ...embeddedVotes };
    if (profileIdQuery && userAnswerData.votes[a.id]) {
      mergedVotesBy[profileIdQuery] = userAnswerData.votes[a.id];
    }

    return {
      ...a,
      votesBy: mergedVotesBy,
      favorited: userAnswerData.favorites.has(a.id),
    };
  });

  // favorite counts for answers (DB-backed)
  try {
    const { getFavoriteCounts } = await import('~/lib/db');
    const favCounts = await getFavoriteCounts(answerIds);
    // attach counts onto answers (non-destructive)
    for (const a of answersWithUserData) {
      (a as any).favCount = favCounts[Number(a.id)] ?? 0;
    }
  } catch (err) {}

  return {
    answers: answersWithUserData,
    topicsById,
    commentsByAnswer,
    total,
    page,
    pageSize,
    users,
  };
}

import { handleAnswerActions } from '~/lib/actionHandlers';

export async function action(args: ActionFunctionArgs) {
  return handleAnswerActions(args);
}

export default function AnswersRoute() {
  type LoaderData = Awaited<ReturnType<typeof loader>>;
  const data = useLoaderData() as LoaderData;
  const answers: Answer[] = data?.answers ?? [];
  const topicsById: Record<string, Topic> = (data as any)?.topicsById ?? {};
  const commentsByAnswer: Record<string, Comment[]> =
    (data as any)?.commentsByAnswer ?? {};
  const users: User[] = (data as any)?.users ?? [];
  const { nameByProfileId, getNameByProfileId } = useNameByProfileId(users);

  const { effectiveId: currentUserId, effectiveName: currentUserName } =
    useIdentity();

  // Client-side user data sync for answers
  const answerIds = answers.map(a => a.id);
  const { data: userAnswerData, markFavorite } = useAnswerUserData(answerIds);

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
      const el = answersContainerRef.current;
      if (el) {
        // Keep existing inner scroll behavior for iOS Safari / non-Chrome browsers
        el.scrollTop = 0;
        try {
          el.scrollTo?.({ top: 0, behavior: 'auto' } as any);
        } catch {}
      }

      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
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
              <FilterForm
                type="answers"
                users={users}
                query={query}
                setQuery={setQuery}
                fromDate={fromDate}
                setFromDate={setFromDate}
                toDate={toDate}
                setToDate={setToDate}
                authorQuery={authorQuery}
                setAuthorQuery={setAuthorQuery}
                sortBy={sortBy}
                setSortBy={setSortBy}
                minScore={minScore}
                setMinScore={setMinScore}
                hasComments={hasComments}
                setHasComments={setHasComments}
                showAdvancedFilters={showAdvancedFilters}
                toggleAdvancedFilters={toggleAdvancedFilters}
                onClear={resetFilters}
                onSubmit={e => {
                  setShowAdvancedFilters(false);
                  try {
                    localStorage.setItem('answers:showAdvancedFilters', '0');
                    const url = new URL(window.location.href);
                    url.searchParams.delete('showAdvancedFilters');
                    history.replaceState(null, '', url.toString());
                  } catch {}
                }}
              />
              {/* Mobile hint: collapse into two rows automatically via flex-wrap */}
            </div>
          </div>
        </div>
      }
      contentRef={answersContainerRef}
    >
      <AnswersList
        answers={paged}
        topicsById={topicsById}
        commentsByAnswer={commentsByAnswer}
        getNameByProfileId={getNameByProfileId}
        currentUserName={currentUserName}
        currentUserId={currentUserId}
        userAnswerData={userAnswerData}
        onFavoriteUpdate={markFavorite}
        actionPath="/answers"
        pagination={{
          currentPage,
          pageCount,
          buildHref,
        }}
      />
    </StickyHeaderLayout>
  );
}
