import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createListLoader } from '~/lib/loaders';

// Mock dependencies
vi.mock('~/lib/queryParser', () => ({
  parsePaginationParams: vi.fn(),
  parseFilterParams: vi.fn(),
}));
vi.mock('~/lib/db', () => ({
  getTopicsPaged: vi.fn(),
  searchAnswers: vi.fn(),
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
      expect(result).toBeInstanceOf(Response);
      const resultData = await result.json();
      expect(resultData).toEqual({ topics: [], total: 0, page: 1, pageSize: 10, q: 'test' });
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
      expect(result).toBeInstanceOf(Response);
      const resultData = await result.json();
      expect(resultData).toEqual({ answers: [], total: 0, page: 1, pageSize: 10, q: 'test', sortBy: 'newest' });
    });
  });
});