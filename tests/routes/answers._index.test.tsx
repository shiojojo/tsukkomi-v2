import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type LoaderFunctionArgs } from 'react-router';
import { loader } from '~/routes/answers._index';

// Mock loaders and actionHandlers
vi.mock('~/lib/loaders', () => ({
  createAnswersListLoader: vi.fn(),
  createListLoader: vi.fn(),
}));
vi.mock('~/lib/loaders/answersLoader', () => ({
  createAnswersLoader: vi.fn(),
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

  it('does not expose a write action', async () => {
    const route = await import('~/routes/answers._index');
    expect('action' in route).toBe(false);
  });
});
