import { useAnswersPage } from '~/hooks/features/answers/useAnswersPage';
import { FilterForm } from '~/components/forms/FilterForm';
import { AnswersList } from '~/components/features/answers/AnswersList';
import { ListPageLayout } from '~/components/layout/ListPageLayout';
import { TopicOverviewCard } from '~/components/features/topics/TopicOverviewCard';
import type { ReactNode } from 'react';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { User } from '~/lib/schemas/user';

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
    commentCounts: Record<string, number>;
    users: User[];
    profileId?: string;
  };
  mode: 'all' | 'topic' | 'favorites';
  topicId?: string;
  topic?: Topic;
}

export function AnswersPage({ data, mode, topicId, topic }: AnswersPageProps) {
  const {
    topicsById,
    commentCounts,
    users,
    answers,
    total,
    getNameByProfileId,
    currentUserId,
    currentUserName,
    userAnswerData,
    profileId,
    filters,
    updateFilter,
    showAdvancedFilters,
    toggleAdvancedFilters,
    currentPage,
    pageCount,
    buildHref,
    answersContainerRef,
  } = useAnswersPage(data);

  const filtersComponent = (
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
        setHasComments={(value: boolean) => updateFilter('hasComments', value)}
        showAdvancedFilters={showAdvancedFilters}
        toggleAdvancedFilters={toggleAdvancedFilters}
        onSubmit={() => toggleAdvancedFilters()}
        mode={mode}
      />
      {/* Mobile hint: collapse into two rows automatically via flex-wrap */}
    </div>
  );

  const answersListComponent = (
    <AnswersList
      answers={answers}
      topicsById={topicsById}
      commentCounts={commentCounts}
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
  );

  let headerTitle: string;
  let extraContent: ReactNode = null;

  if (mode === 'favorites') {
    headerTitle = 'お気に入り';
  } else if (mode === 'topic') {
    headerTitle = `${topic?.id || 'トピック'} - 回答一覧`;
    extraContent = topic && (
      <TopicOverviewCard topic={topic} answerCount={total} />
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
