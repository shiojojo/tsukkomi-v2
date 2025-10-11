import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { useEffect, useState, useRef } from 'react';
import { AnswersList } from '~/components/features/answers/AnswersList';
import { useAnswersPage } from '~/hooks/useAnswersPage';
import { FilterForm } from '~/components/forms/FilterForm';
import { ListPageLayout } from '~/components/layout/ListPageLayout';

// Simple in-memory guard to suppress very short-window duplicate POSTs.

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const topicId = url.searchParams.get('topicId') ?? undefined;
  const { createAnswersListLoader } = await import('~/lib/loaders');
  return await createAnswersListLoader(request, { topicId });
}

import { handleAnswerActions } from '~/lib/actionHandlers';

export async function action(args: ActionFunctionArgs) {
  return handleAnswerActions(args);
}

export default function AnswersRoute() {
  const data = useLoaderData() as {
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
            onSubmit={() => toggleAdvancedFilters()}
          />
          {/* Mobile hint: collapse into two rows automatically via flex-wrap */}
        </div>
      }
      list={
        <AnswersList
          answers={answers}
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

import { isRouteErrorResponse } from 'react-router';
import type { Route } from './+types/answers._index';
import { ErrorBoundary as ErrorBoundaryComponent } from '~/components/common/ErrorBoundary';

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <ErrorBoundaryComponent showDetails={import.meta.env.DEV}>
      <div />
    </ErrorBoundaryComponent>
  );
}
