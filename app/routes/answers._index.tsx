import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { useEffect, useState, useRef } from 'react';
import { AnswersList } from '~/components/features/answers/AnswersList';
import { useAnswerUserData } from '~/hooks/useAnswerUserData';
import { useIdentity } from '~/hooks/useIdentity';
import { useNameByProfileId } from '~/hooks/useNameByProfileId';
import { useFilters, type AnswersFilters } from '~/hooks/useFilters';
import { FilterForm } from '~/components/forms/FilterForm';
import { ListPageLayout } from '~/components/layout/ListPageLayout';
// server-only imports are done inside loader/action to avoid bundling Supabase client in browser code
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { Comment } from '~/lib/schemas/comment';
import type { User } from '~/lib/schemas/user';

// Simple in-memory guard to suppress very short-window duplicate POSTs.
import { createListLoader } from '~/lib/loaders';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const profileIdQuery = params.get('profileId') ?? undefined;
  const topicId = params.get('topicId') ?? undefined;

  const { getTopics, getCommentsForAnswers, getUsers, getUserAnswerData } =
    await import('~/lib/db');
  const topics = await getTopics();
  const topicsById = Object.fromEntries(topics.map(t => [String(t.id), t]));
  // Limit users fetched for the answers listing to avoid scanning the entire profiles table
  const users = await getUsers({ limit: 200 });

  const listData = await createListLoader('answers', request, { topicId });
  const {
    answers: rawAnswers,
    total,
    page,
    pageSize,
    q,
    author,
    sortBy,
    minScore,
    hasComments,
    fromDate,
    toDate,
  } = listData as any;
  const answers = rawAnswers as Answer[];
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
    q,
    author,
    sortBy,
    minScore,
    hasComments,
    fromDate,
    toDate,
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
  const qParam: string = (data as any)?.q ?? '';
  const authorParam: string = (data as any)?.author ?? '';
  const sortByParam: string = (data as any)?.sortBy ?? 'newest';
  const sortBy: 'newest' | 'oldest' | 'scoreDesc' =
    sortByParam === 'oldest' || sortByParam === 'scoreDesc'
      ? (sortByParam as any)
      : 'newest';
  const minScoreParam: string = String((data as any)?.minScore ?? '');
  const hasCommentsParam: boolean = (data as any)?.hasComments ?? false;
  const fromDateParam: string = (data as any)?.fromDate ?? '';
  const toDateParam: string = (data as any)?.toDate ?? '';

  const { getNameByProfileId } = useNameByProfileId(users);

  const { effectiveId: currentUserId, effectiveName: currentUserName } =
    useIdentity();

  // Client-side user data sync for answers
  const answerIds = answers.map(a => a.id);
  const { data: userAnswerData, markFavorite } = useAnswerUserData(answerIds);

  // Filter UI state (server-driven via GET form)
  const initialFilters: AnswersFilters = {
    q: qParam,
    author: authorParam,
    sortBy: sortBy,
    minScore: minScoreParam,
    hasComments: hasCommentsParam,
    fromDate: fromDateParam,
    toDate: toDateParam,
  };

  const urlKeys: Record<keyof AnswersFilters, string> = {
    q: 'q',
    author: 'authorName',
    sortBy: 'sortBy',
    minScore: 'minScore',
    hasComments: 'hasComments',
    fromDate: 'fromDate',
    toDate: 'toDate',
  };

  const { filters, updateFilter } = useFilters(initialFilters, urlKeys, false);

  const [showAdvancedFilters, setShowAdvancedFilters] =
    useState<boolean>(false);

  // ref to the scrollable answers container so we can scroll to top on page change
  const answersContainerRef = useRef<HTMLDivElement | null>(null);

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
    if (filters.q) parts.push(`q=${encodeURIComponent(filters.q)}`);
    if (filters.author)
      parts.push(`authorName=${encodeURIComponent(filters.author)}`);
    parts.push(`sortBy=${encodeURIComponent(String(filters.sortBy))}`);
    parts.push(`page=${p}`);
    if (filters.minScore)
      parts.push(`minScore=${encodeURIComponent(String(filters.minScore))}`);
    if (filters.hasComments) parts.push('hasComments=1');
    if (filters.fromDate)
      parts.push(`fromDate=${encodeURIComponent(filters.fromDate)}`);
    if (filters.toDate)
      parts.push(`toDate=${encodeURIComponent(filters.toDate)}`);
    return `?${parts.join('&')}`;
  };

  return (
    <ListPageLayout
      headerTitle="大喜利 - 回答一覧"
      filters={
        <div className="mt-3">
          <FilterForm
            type="answers"
            users={users}
            query={filters.q}
            setQuery={(value: string) => updateFilter('q', value)}
            fromDate={filters.fromDate}
            setFromDate={(value: string) => updateFilter('fromDate', value)}
            toDate={filters.toDate}
            setToDate={(value: string) => updateFilter('toDate', value)}
            authorQuery={filters.author}
            setAuthorQuery={(value: string) => updateFilter('author', value)}
            sortBy={filters.sortBy}
            setSortBy={(value: 'newest' | 'oldest' | 'scoreDesc') =>
              updateFilter('sortBy', value)
            }
            minScore={filters.minScore}
            setMinScore={(value: string) => updateFilter('minScore', value)}
            hasComments={filters.hasComments}
            setHasComments={(value: boolean) =>
              updateFilter('hasComments', value)
            }
            showAdvancedFilters={showAdvancedFilters}
            toggleAdvancedFilters={toggleAdvancedFilters}
            onSubmit={() => setShowAdvancedFilters(false)}
          />
          {/* Mobile hint: collapse into two rows automatically via flex-wrap */}
        </div>
      }
      list={
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
      }
      contentRef={answersContainerRef}
    />
  );
}
