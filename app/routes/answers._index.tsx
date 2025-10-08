import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { useEffect, useState, useRef } from 'react';
import { AnswersList } from '~/components/features/answers/AnswersList';
import { useAnswersPage } from '~/hooks/useAnswersPage';
import { FilterForm } from '~/components/forms/FilterForm';
import { ListPageLayout } from '~/components/layout/ListPageLayout';
// server-only imports are done inside loader/action to avoid bundling Supabase client in browser code
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { Comment } from '~/lib/schemas/comment';
import type { User } from '~/lib/schemas/user';

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
  type LoaderData = Awaited<ReturnType<typeof loader>>;
  const data = useLoaderData() as LoaderData;

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
  } = useAnswersPage(data as any);

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
