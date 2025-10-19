import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { loader, action } from '~/routes/answers._index';

type AnswersListData = {
  answers: unknown[];
  total: number;
  page: number;
  pageSize: number;
  q?: string;
  author?: string;
  sortBy: string;
  minScore?: number;
  hasComments?: boolean;
  fromDate?: string;
  toDate?: string;
  topicsById: Record<string, unknown>;
  commentsByAnswer: Record<string, unknown>;
  users: unknown[];
  profileId: string | null;
};

// Mock loaders and actionHandlers
vi.mock('~/lib/loaders', () => ({
  createAnswersListLoader: vi.fn(),
  createListLoader: vi.fn(),
}));
vi.mock('~/lib/actionHandlers', () => ({
  handleAnswerActions: vi.fn(),
}));

describe('answers._index route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loader', () => {
    it('should call createAnswersListLoader', async () => {
      const mockRequest = new Request('http://localhost/answers');
      const mockData = {
        answers: [
          {
            id: 1,
            text: 'Test Answer',
            created_at: '2023-01-01',
            votes: { level1: 0, level2: 0, level3: 0 },
            votesBy: {},
            profileId: undefined,
            topicId: 1,
            favorited: undefined,
            favCount: 0,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        q: undefined,
        fromDate: undefined,
        toDate: undefined,
        author: undefined,
        sortBy: 'newest' as const,
        minScore: undefined,
        hasComments: undefined,
        topicsById: {},
        commentsByAnswer: {},
        users: [],
        profileId: null,
      } as AnswersListData;
      const { createListLoader } = await import('~/lib/loaders');
      vi.mocked(createListLoader).mockResolvedValue(
        new Response(JSON.stringify(mockData))
      );

      const result = await loader({
        request: mockRequest,
      } as LoaderFunctionArgs);
      expect(createListLoader).toHaveBeenCalledWith('answers', mockRequest, {
        topicId: undefined,
      });
      expect(await result.json()).toEqual({
        ...mockData,
        profileId: undefined,
      });
    });
  });

  describe('action', () => {
    it('should call handleAnswerActions', async () => {
      const mockArgs = {
        request: new Request('http://localhost/answers', { method: 'POST' }),
      } as ActionFunctionArgs;
      const mockResponse = new Response(JSON.stringify({ ok: true }), {
        status: 200,
      });
      const { handleAnswerActions } = await import('~/lib/actionHandlers');
      vi.mocked(handleAnswerActions).mockResolvedValue(mockResponse);

      const result = await action(mockArgs);
      expect(handleAnswerActions).toHaveBeenCalledWith(mockArgs);
      expect(result).toEqual(mockResponse);
    });
  });
});
