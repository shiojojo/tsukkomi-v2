import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { loader, action } from '~/routes/answers._index';

// Mock loaders and actionHandlers
vi.mock('~/lib/loaders', () => ({
  createAnswersListLoader: vi.fn(),
  createListLoader: vi.fn(),
}));
vi.mock('~/lib/loaders/answersLoader', () => ({
  createAnswersLoader: vi.fn(),
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
            topicId: 1,
            favCount: 0,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        sortBy: 'newest' as const,
        topicsById: {
          '1': {
            id: 1,
            title:
              '「学生ロボットコンテスト」のテレビ欄。なんじゃそれ！何と書かれていた？',
            created_at: '2023-12-30T00:00:00+00:00',
            image: null,
          },
        },
        users: [],
        profileId: undefined,
      };
      const { createAnswersLoader } = await import(
        '~/lib/loaders/answersLoader'
      );
      vi.mocked(createAnswersLoader).mockResolvedValue(
        new Response(JSON.stringify(mockData))
      );

      const result = await loader({
        request: mockRequest,
      } as LoaderFunctionArgs);
      expect(createAnswersLoader).toHaveBeenCalledWith({
        request: mockRequest,
      });
      expect(await result.json()).toEqual(mockData);
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
