import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createListLoader, createAnswersListLoader } from '~/lib/loaders';

// Mock dependencies
vi.mock('~/lib/queryParser', () => ({
  parsePaginationParams: vi.fn(),
  parseFilterParams: vi.fn(),
}));
vi.mock('~/lib/db', () => ({
  getTopicsPaged: vi.fn(),
  searchAnswers: vi.fn(),
  getTopics: vi.fn(),
  getUsers: vi.fn(),
  getCommentsForAnswers: vi.fn(),
  getUserAnswerData: vi.fn(),
  getFavoriteCounts: vi.fn(),
}));
vi.mock('~/lib/utils/dataMerging', () => ({
  mergeUserDataIntoAnswers: vi.fn(),
}));

describe('loaders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createListLoader', () => {
    it('should handle topics', async () => {
      const mockRequest = new Request('http://localhost/topics');
      const { parsePaginationParams, parseFilterParams } = await import('~/lib/queryParser');
      vi.mocked(parsePaginationParams).mockReturnValue({ page: 1, pageSize: 10 });
      vi.mocked(parseFilterParams).mockReturnValue({ q: 'test' });
      const { getTopicsPaged } = await import('~/lib/db');
      vi.mocked(getTopicsPaged).mockResolvedValue({ topics: [], total: 0 });

      const result = await createListLoader('topics', mockRequest);
      expect(parsePaginationParams).toHaveBeenCalledWith(mockRequest);
      expect(parseFilterParams).toHaveBeenCalledWith(mockRequest, 'topics');
      expect(getTopicsPaged).toHaveBeenCalledWith({ page: 1, pageSize: 10, q: 'test' });
      expect(result).toEqual({ topics: [], total: 0, page: 1, pageSize: 10, q: 'test' });
    });

    it('should handle answers', async () => {
      const mockRequest = new Request('http://localhost/answers');
      const { parsePaginationParams, parseFilterParams } = await import('~/lib/queryParser');
      vi.mocked(parsePaginationParams).mockReturnValue({ page: 1, pageSize: 10 });
      vi.mocked(parseFilterParams).mockReturnValue({ q: 'test', sortBy: 'newest' });
      const { searchAnswers } = await import('~/lib/db');
      vi.mocked(searchAnswers).mockResolvedValue({ answers: [], total: 0 });

      const result = await createListLoader('answers', mockRequest);
      expect(searchAnswers).toHaveBeenCalledWith({ page: 1, pageSize: 10, q: 'test', sortBy: 'newest' });
      expect(result).toEqual({ answers: [], total: 0, page: 1, pageSize: 10, q: 'test', sortBy: 'newest' });
    });
  });

  describe('createAnswersListLoader', () => {
    it('should aggregate data', async () => {
      const mockRequest = new Request('http://localhost/answers');
      const { getTopics, getUsers, getCommentsForAnswers, getUserAnswerData, getFavoriteCounts } = await import('~/lib/db');
      const { mergeUserDataIntoAnswers } = await import('~/lib/utils/dataMerging');

      vi.mocked(getTopics).mockResolvedValue([{ id: 1, title: 'Topic', created_at: '2023-01-01' }]);
      vi.mocked(getUsers).mockResolvedValue([{ id: 'user1', name: 'User' }]);
      vi.mocked(getCommentsForAnswers).mockResolvedValue({});
      vi.mocked(getUserAnswerData).mockResolvedValue({ votes: {}, favorites: new Set() });
      vi.mocked(getFavoriteCounts).mockResolvedValue({});
      vi.mocked(mergeUserDataIntoAnswers).mockReturnValue([]);

      // Mock createListLoader
      const mockListData = { answers: [], total: 0, page: 1, pageSize: 10 };
      vi.doMock('~/lib/loaders', () => ({
        createListLoader: vi.fn().mockResolvedValue(mockListData),
      }));

      const result = await createAnswersListLoader(mockRequest);
      expect(getTopics).toHaveBeenCalled();
      expect(getUsers).toHaveBeenCalledWith({ limit: 200 });
      expect(result).toHaveProperty('answers');
      expect(result).toHaveProperty('topicsById');
      expect(result).toHaveProperty('commentsByAnswer');
      expect(result).toHaveProperty('users');
    });
  });
});