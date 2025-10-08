import { useState, useEffect, useRef } from 'react';
import { useAnswerUserData } from './useAnswerUserData';
import { useIdentity } from './useIdentity';
import { useNameByProfileId } from './useNameByProfileId';
import { useFilters, type AnswersFilters } from './useFilters';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { Comment } from '~/lib/schemas/comment';
import type { User } from '~/lib/schemas/user';

type LoaderData = {
  answers: Answer[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
  author: string;
  sortBy: string;
  minScore: string;
  hasComments: boolean;
  fromDate: string;
  toDate: string;
  topicsById: Record<string, Topic>;
  commentsByAnswer: Record<string, Comment[]>;
  users: User[];
  profileId?: string;
};

export function useAnswersPage(data: LoaderData) {
  // Extract data
  const topicsById = data.topicsById ?? {};
  const commentsByAnswer = data.commentsByAnswer ?? {};
  const users = data.users ?? [];
  const qParam = data.q ?? '';
  const authorParam = data.author ?? '';
  const sortByParam = data.sortBy ?? 'newest';
  const sortBy: 'newest' | 'oldest' | 'scoreDesc' =
    sortByParam === 'oldest' || sortByParam === 'scoreDesc'
      ? (sortByParam as any)
      : 'newest';
  const minScoreParam = String(data.minScore ?? '');
  const hasCommentsParam = data.hasComments ?? false;
  const fromDateParam = data.fromDate ?? '';
  const toDateParam = data.toDate ?? '';
  const profileId = data.profileId ?? undefined;

  const { getNameByProfileId } = useNameByProfileId(users);
  const { effectiveId: currentUserId, effectiveName: currentUserName } = useIdentity();

  // Client-side user data sync for answers
  const answerIds = data.answers?.map((a: Answer) => a.id) ?? [];
  const { data: userAnswerData, markFavorite } = useAnswerUserData(answerIds);

  // Filter UI state (server-driven via GET form)
  const initialFilters: AnswersFilters = {
    q: qParam,
    author: authorParam,
    sortBy,
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

  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(
    () => {
      if (typeof window === 'undefined') return false;
      try {
        const params = new URLSearchParams(window.location.search);
        return params.get('showAdvancedFilters') === '1';
      } catch {
        return false;
      }
    }
  );

  const toggleAdvancedFilters = () => {
    setShowAdvancedFilters(s => {
      const next = !s;
      try {
        const url = new URL(window.location.href);
        if (next) url.searchParams.set('showAdvancedFilters', '1');
        else url.searchParams.delete('showAdvancedFilters');
        history.replaceState(null, '', url.toString());
      } catch {}
      return next;
    });
  };

  // Server-driven pagination
  const serverPage = data.page ?? 1;
  const serverPageSize = data.pageSize ?? 20;
  const total = data.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / serverPageSize));
  const currentPage = Math.min(Math.max(1, serverPage), pageCount);
  const answers = data.answers ?? [];

  // ref to the scrollable answers container
  const answersContainerRef = useRef<HTMLDivElement | null>(null);

  // Scroll to top when page changes
  useEffect(() => {
    try {
      const el = answersContainerRef.current;
      if (el) {
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

  // helper to build href preserving current filters
  const buildHref = (p: number) => {
    const parts: string[] = [];
    if (filters.q) parts.push(`q=${encodeURIComponent(filters.q)}`);
    if (filters.author) parts.push(`authorName=${encodeURIComponent(filters.author)}`);
    parts.push(`sortBy=${encodeURIComponent(String(filters.sortBy))}`);
    parts.push(`page=${p}`);
    parts.push(`pageSize=${serverPageSize}`);
    if (filters.minScore) parts.push(`minScore=${encodeURIComponent(String(filters.minScore))}`);
    if (filters.hasComments) parts.push('hasComments=1');
    if (filters.fromDate) parts.push(`fromDate=${encodeURIComponent(filters.fromDate)}`);
    if (filters.toDate) parts.push(`toDate=${encodeURIComponent(filters.toDate)}`);
    return `?${parts.join('&')}`;
  };

  return {
    // Data
    topicsById,
    commentsByAnswer,
    users,
    answers,
    total,
    // User
    getNameByProfileId,
    currentUserId,
    currentUserName,
    userAnswerData,
    markFavorite,
    profileId,
    // Filters
    filters,
    updateFilter,
    showAdvancedFilters,
    toggleAdvancedFilters,
    // Pagination
    currentPage,
    pageCount,
    buildHref,
    // Refs
    answersContainerRef,
  };
}