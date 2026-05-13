import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createListLoader } from '~/lib/loaders';

// Mock dependencies
vi.mock('~/lib/queryParser', () => ({
  parsePaginationParams: vi.fn(),
  parseAnswersFilterParams: vi.fn(),
  parseCommonFilterParams: vi.fn(),
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
      const { parsePaginationParams, parseCommonFilterParams } = await import('~/lib/queryParser');
      vi.mocked(parsePaginationParams).mockReturnValue({ page: 1, pageSize: 10 });
      vi.mocked(parseCommonFilterParams).mockReturnValue({ q: 'test' });
      const { getTopicsPaged } = await import('~/lib/db');
      vi.mocked(getTopicsPaged).mockResolvedValue({ topics: [], total: 0 });

      const result = await createListLoader('topics', mockRequest);
      expect(parsePaginationParams).toHaveBeenCalledWith(mockRequest);
      expect(parseCommonFilterParams).toHaveBeenCalledWith(mockRequest);
      expect(getTopicsPaged).toHaveBeenCalledWith({ page: 1, pageSize: 10, q: 'test' });
      expect(result).toBeInstanceOf(Response);
      const resultData = await result.json();
      expect(resultData).toEqual({ topics: [], total: 0, page: 1, pageSize: 10, q: 'test' });
    });

    it('should handle answers', async () => {
      const mockRequest = new Request('http://localhost/answers');
      const { parsePaginationParams, parseAnswersFilterParams } = await import('~/lib/queryParser');
      vi.mocked(parsePaginationParams).mockReturnValue({ page: 1, pageSize: 10 });
      vi.mocked(parseAnswersFilterParams).mockReturnValue({ q: 'test', sortBy: 'newest' });
      const { searchAnswers } = await import('~/lib/db');
      vi.mocked(searchAnswers).mockResolvedValue({ answers: [], total: 0 });

      const result = await createListLoader('answers', mockRequest);
      expect(searchAnswers).toHaveBeenCalledWith({ page: 1, pageSize: 10, q: 'test', sortBy: 'newest' });
      expect(result).toBeInstanceOf(Response);
      const resultData = await result.json();
      expect(resultData).toEqual({ answers: [], total: 0, page: 1, pageSize: 10, q: 'test', sortBy: 'newest' });
    });

    it('should use the provided query source when available', async () => {
      const mockRequest = new Request('http://localhost/answers');
      const normalizedUrl = new URL(
        'http://localhost/answers?sortBy=newest&minScore=1'
      );
      const { parsePaginationParams, parseAnswersFilterParams } = await import('~/lib/queryParser');
      vi.mocked(parsePaginationParams).mockReturnValue({ page: 1, pageSize: 10 });
      vi.mocked(parseAnswersFilterParams).mockReturnValue({ sortBy: 'newest', minScore: 1 });
      const { searchAnswers } = await import('~/lib/db');
      vi.mocked(searchAnswers).mockResolvedValue({ answers: [], total: 0 });

      await createListLoader('answers', mockRequest, undefined, normalizedUrl);

      expect(parsePaginationParams).toHaveBeenCalledWith(normalizedUrl);
      expect(parseAnswersFilterParams).toHaveBeenCalledWith(normalizedUrl);
      expect(searchAnswers).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
        sortBy: 'newest',
        minScore: 1,
      });
    });
  });
});
