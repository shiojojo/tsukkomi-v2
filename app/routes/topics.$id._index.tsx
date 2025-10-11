import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, useParams } from 'react-router';
import { useEffect, useState, useRef } from 'react';
import { AnswersList } from '~/components/features/answers/AnswersList';
import { TopicOverviewCard } from '~/components/features/topics/TopicOverviewCard';
import { useAnswersPage } from '~/hooks/useAnswersPage';
import { FilterForm } from '~/components/forms/FilterForm';
import StickyHeaderLayout from '~/components/layout/StickyHeaderLayout';
import { ErrorBoundary as ErrorBoundaryComponent } from '~/components/common/ErrorBoundary';
// server-only imports are done inside loader/action to avoid bundling Supabase client in browser code
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { Comment } from '~/lib/schemas/comment';
import type { User } from '~/lib/schemas/user';

// Simple in-memory guard to suppress very short-window duplicate POSTs.

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const topicId = params.id ? String(params.id) : undefined;
    const { createAnswersListLoader } = await import('~/lib/loaders');
    return await createAnswersListLoader(request, { topicId });
  } catch (error) {
    console.error('Failed to load topic answers:', error);
    // Return a safe fallback response
    return Response.json({
      answers: [],
      total: 0,
      page: 1,
      pageSize: 20,
      q: '',
      author: '',
      sortBy: 'created_at',
      fromDate: '',
      toDate: '',
      topicsById: {},
      commentsByAnswer: {},
      users: [],
    });
  }
}

import { handleAnswerActions } from '~/lib/actionHandlers';

export async function action(args: ActionFunctionArgs) {
  return handleAnswerActions(args);
}

export default function TopicDetailRoute() {
  const data = useLoaderData() as {
    answers: any[];
    total: number;
    page: number;
    pageSize: number;
    q: string;
    author: string;
    sortBy: string;
    fromDate: string;
    toDate: string;
    topicsById: Record<string, any>;
    commentsByAnswer: Record<string, any[]>;
    users: any[];
  };
  const params = useParams();

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
    markFavorite,
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

  const topicId = params.id ? String(params.id) : '';
  const topic = topicsById[topicId];

  return (
    <StickyHeaderLayout
      header={
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
            onSubmit={() => toggleAdvancedFilters()}
          />
        </div>
      }
      contentRef={answersContainerRef}
    >
      <TopicOverviewCard topic={topic} answerCount={total} />
      <AnswersList
        answers={answers}
        topicsById={topicsById}
        commentsByAnswer={commentsByAnswer}
        getNameByProfileId={getNameByProfileId}
        currentUserName={currentUserName}
        currentUserId={currentUserId}
        userAnswerData={userAnswerData}
        onFavoriteUpdate={markFavorite}
        actionPath={`/topics/${topicId}`}
        profileIdForVotes={profileId ?? currentUserId}
        emptyMessage="まだ回答が投稿されていません。"
        pagination={{
          currentPage,
          pageCount,
          buildHref,
        }}
      />
    </StickyHeaderLayout>
  );
}

export function ErrorBoundary() {
  return (
    <ErrorBoundaryComponent showDetails={import.meta.env.DEV}>
      <div />
    </ErrorBoundaryComponent>
  );
}
