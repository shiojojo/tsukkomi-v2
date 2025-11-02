import { useAnswersPageData } from '~/hooks/features/answers/useAnswersPageData';
import { useAnswersPage } from '~/hooks/features/answers/useAnswersPage';
import { lazy, Suspense } from 'react';
import { ListPageLayout } from '~/components/layout/ListPageLayout';
import type { ReactNode } from 'react';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { User } from '~/lib/schemas/user';

// Lazy load components to reduce initial bundle size
const FilterForm = lazy(() =>
  import('~/components/forms/FilterForm').then(module => ({
    default: module.FilterForm,
  }))
);

const AnswersList = lazy(() =>
  import('~/components/features/answers/AnswersList').then(module => ({
    default: module.AnswersList,
  }))
);

const TopicOverviewCard = lazy(() =>
  import('~/components/features/topics/TopicOverviewCard').then(module => ({
    default: module.TopicOverviewCard,
  }))
);

interface AnswersPageProps {
  data: {
    answers: Answer[];
    total: number;
    page: number;
    pageSize: number;
    q: string;
    author: string;
    sortBy: string;
    minScore: number;
    hasComments: boolean;
    fromDate: string;
    toDate: string;
    topicsById: Record<string, Topic>;
    users: User[];
    profileId?: string;
  };
  mode: 'all' | 'topic' | 'favorites';
  topicId?: string;
  topic?: Topic;
}

export function AnswersPage({ data, mode, topicId, topic }: AnswersPageProps) {
  const { pageData, userAnswerData } = useAnswersPageData(data);
  const {
    topicsById,
    users,
    answers,
    total,
    getNameByProfileId,
    currentUserId,
    currentUserName,
    profileId,
    filters,
    updateFilter,
    showAdvancedFilters,
    toggleAdvancedFilters,
    currentPage,
    pageCount,
    buildHref,
    answersContainerRef,
  } = useAnswersPage(pageData);

  const filtersComponent = (
    <Suspense
      fallback={<div className="mt-3 h-20 bg-muted animate-pulse rounded" />}
    >
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
        setHasComments={(value: boolean) => updateFilter('hasComments', value)}
        showAdvancedFilters={showAdvancedFilters}
        toggleAdvancedFilters={toggleAdvancedFilters}
        onSubmit={() => toggleAdvancedFilters()}
        mode={mode}
      />
    </Suspense>
  );

  const answersListComponent = (
    <Suspense
      fallback={
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded" />
          ))}
        </div>
      }
    >
      <AnswersList
        answers={answers}
        topicsById={topicsById}
        getNameByProfileId={getNameByProfileId}
        currentUserName={currentUserName}
        currentUserId={currentUserId}
        userAnswerData={userAnswerData}
        actionPath={
          mode === 'topic'
            ? `/topics/${topicId}`
            : mode === 'favorites'
              ? '/answers/favorites'
              : '/answers'
        }
        profileIdForVotes={profileId}
        pagination={
          pageCount > 1
            ? {
                currentPage,
                pageCount,
                buildHref,
              }
            : undefined
        }
        emptyMessage={
          mode === 'topic'
            ? 'このお題に対する回答がまだありません。'
            : '条件に一致する回答がありません。'
        }
      />
    </Suspense>
  );

  let headerTitle: string;
  let extraContent: ReactNode = null;

  if (mode === 'favorites') {
    headerTitle = 'お気に入り';
  } else if (mode === 'topic') {
    headerTitle = `${topic?.id || 'トピック'} - 回答一覧`;
    extraContent = topic && (
      <Suspense
        fallback={<div className="h-24 bg-muted animate-pulse rounded" />}
      >
        <TopicOverviewCard topic={topic} answerCount={total} />
      </Suspense>
    );
  } else {
    // mode === 'all'
    headerTitle = '大喜利 - 回答一覧';
  }

  return (
    <ListPageLayout
      headerTitle={headerTitle}
      filters={filtersComponent}
      list={answersListComponent}
      extraContent={extraContent}
      contentRef={answersContainerRef}
    />
  );
}
