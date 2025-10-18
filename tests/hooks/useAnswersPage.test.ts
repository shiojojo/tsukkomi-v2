import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAnswersPage } from '~/hooks/features/answers/useAnswersPage';

// Mock dependencies
vi.mock('~/hooks/features/answers/useAnswerUserData', () => ({
  useAnswerUserData: vi.fn(() => ({
    userAnswerData: {},
    markFavorite: vi.fn(),
  })),
}));

vi.mock('~/hooks/common/useIdentity', () => ({
  useIdentity: vi.fn(() => ({
    effectiveId: 'test-user-id',
    effectiveName: 'Test User',
  })),
}));

vi.mock('~/hooks/common/useNameByProfileId', () => ({
  useNameByProfileId: vi.fn(() => ({
    getNameByProfileId: vi.fn(() => 'Test User'),
  })),
}));

vi.mock('~/hooks/common/useFilters', () => ({
  useFilters: vi.fn(() => ({
    filters: {
      q: '',
      author: '',
      sortBy: 'newest',
      minScore: '',
      hasComments: false,
      fromDate: '',
      toDate: '',
    },
    updateFilter: vi.fn(),
    showAdvancedFilters: false,
    toggleAdvancedFilters: vi.fn(),
  })),
}));

vi.mock('~/hooks/common/useScrollReset', () => ({
  useScrollReset: vi.fn(),
}));

describe('useAnswersPage', () => {
  const mockData = {
    answers: [
      {
        id: 1,
        text: 'Test answer',
        profileId: 'user-1',
        topicId: 1,
        created_at: '2024-01-01T00:00:00Z',
        votes: { level1: 0, level2: 0, level3: 0 },
        votesBy: {},
        favorited: false,
        favCount: 0,
      },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
    q: 'test query',
    author: 'test author',
    sortBy: 'newest',
    minScore: 1,
    hasComments: true,
    fromDate: '2024-01-01',
    toDate: '2024-12-31',
    topicsById: {
      '1': { id: 1, title: 'Test Topic', created_at: '2024-01-01T00:00:00Z', image: null },
    },
    commentsByAnswer: {
      '1': [{ id: 1, text: 'Test comment', created_at: '2024-01-01T00:00:00Z', answerId: 1, profileId: 'user-1' }],
    },
    users: [
      { id: 'user-1', name: 'Test User' },
    ],
    profileId: 'test-profile-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns correct data structure', () => {
    const { result } = renderHook(() => useAnswersPage(mockData));

    expect(result.current).toHaveProperty('topicsById');
    expect(result.current).toHaveProperty('commentsByAnswer');
    expect(result.current).toHaveProperty('users');
    expect(result.current).toHaveProperty('answers');
    expect(result.current).toHaveProperty('total');
    expect(result.current).toHaveProperty('getNameByProfileId');
    expect(result.current).toHaveProperty('currentUserId');
    expect(result.current).toHaveProperty('currentUserName');
    expect(result.current).toHaveProperty('userAnswerData');
    expect(result.current).toHaveProperty('profileId');
    expect(result.current).toHaveProperty('filters');
    expect(result.current).toHaveProperty('updateFilter');
    expect(result.current).toHaveProperty('showAdvancedFilters');
    expect(result.current).toHaveProperty('toggleAdvancedFilters');
    expect(result.current).toHaveProperty('currentPage');
    expect(result.current).toHaveProperty('pageCount');
    expect(result.current).toHaveProperty('buildHref');
  });

  it('initializes with correct values', () => {
    const { result } = renderHook(() => useAnswersPage(mockData));

    expect(result.current.topicsById).toEqual(mockData.topicsById);
    expect(result.current.commentsByAnswer).toEqual(mockData.commentsByAnswer);
    expect(result.current.users).toEqual(mockData.users);
    expect(result.current.answers).toEqual(mockData.answers);
    expect(result.current.total).toBe(mockData.total);
    expect(result.current.currentUserId).toBe('test-user-id');
    expect(result.current.currentUserName).toBe('Test User');
    expect(result.current.profileId).toBe('test-profile-id');
  });

  it('handles empty data gracefully', () => {
    const emptyData = {
      answers: [],
      total: 0,
      page: 1,
      pageSize: 20,
      sortBy: 'newest',
      topicsById: {},
      commentsByAnswer: {},
      users: [],
    };

    const { result } = renderHook(() => useAnswersPage(emptyData));

    expect(result.current.answers).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.topicsById).toEqual({});
    expect(result.current.commentsByAnswer).toEqual({});
    expect(result.current.users).toEqual([]);
  });
});