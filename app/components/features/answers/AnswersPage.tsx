import { useAnswersPage } from '~/hooks/features/answers/useAnswersPage';
import { FilterForm } from '~/components/forms/FilterForm';
import { AnswersList } from '~/components/features/answers/AnswersList';
import { ListPageLayout } from '~/components/layout/ListPageLayout';
import StickyHeaderLayout from '~/components/layout/StickyHeaderLayout';
import { TopicOverviewCard } from '~/components/features/topics/TopicOverviewCard';

interface AnswersPageProps {
  data: {
    answers: any[];
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
    topicsById: Record<string, any>;
    commentsByAnswer: Record<string, any[]>;
    users: any[];
    profileId?: string;
  };
  mode: 'all' | 'topic' | 'favorites';
  topicId?: string;
  topic?: any;
}

export function AnswersPage({ data, mode, topicId, topic }: AnswersPageProps) {
  const {
    topicsById,
    commentsByAnswer,
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
      commentsByAnswer={commentsByAnswer}
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
      profileIdForVotes={profileId ?? currentUserId}
      emptyMessage={
        mode === 'topic' ? 'まだ回答が投稿されていません。' : undefined
      }
      pagination={{
        currentPage,
        pageCount,
        buildHref,
      }}
    />
  );

  if (mode === 'all' || mode === 'favorites') {
    return (
      <ListPageLayout
        headerTitle={mode === 'favorites' ? 'お気に入り' : '大喜利 - 回答一覧'}
        filters={filtersComponent}
        list={answersListComponent}
        contentRef={answersContainerRef}
      />
    );
  }

  return (
    <StickyHeaderLayout
      header={filtersComponent}
      contentRef={answersContainerRef}
    >
      {topic && <TopicOverviewCard topic={topic} answerCount={total} />}
      {answersListComponent}
    </StickyHeaderLayout>
  );
}
