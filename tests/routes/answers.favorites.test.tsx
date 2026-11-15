import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type LoaderFunctionArgs } from 'react-router';
import { loader } from '~/routes/answers.favorites';

// Mock db
vi.mock('~/lib/loaders', () => ({
  createAnswersListLoader: vi.fn(),
  createListLoader: vi.fn(),
}));
vi.mock('~/lib/loaders/answersLoader', () => ({
  createAnswersLoader: vi.fn(),
}));
describe('answers.favorites route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loader', () => {
    it('should return default data when profileId is not provided', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          answers: [],
          total: 0,
          page: 1,
          pageSize: 20,
          q: '',
          author: '',
          sortBy: 'newest',
          minScore: 0,
          hasComments: false,
          fromDate: '',
          toDate: '',
          profileId: null,
          requiresProfileId: true,
          topicsById: {},
        })
      );
      const { createAnswersLoader } = await import(
        '~/lib/loaders/answersLoader'
      );
      vi.mocked(createAnswersLoader).mockResolvedValue(mockResponse);

      const request = new Request('http://localhost:3000/answers/favorites');
      const result = await loader({ request } as LoaderFunctionArgs);

      expect(createAnswersLoader).toHaveBeenCalledWith(
        { request },
        { favorite: true, requiresAuth: true }
      );

      const data = await result.json();
      expect(data).toEqual({
        answers: [],
        total: 0,
        page: 1,
        pageSize: 20,
        q: '',
        author: '',
        sortBy: 'newest',
        minScore: 0,
        hasComments: false,
        fromDate: '',
        toDate: '',
        profileId: null,
        requiresProfileId: true,
        topicsById: {},
      });
    });

    it('should call createAnswersListLoader with correct params when profileId is provided', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          answers: [{ id: 1 }],
          total: 1,
          requiresProfileId: false,
          profileId: 'user123',
          topicsById: {},
        })
      );
      const { createAnswersLoader } = await import(
        '~/lib/loaders/answersLoader'
      );
      vi.mocked(createAnswersLoader).mockResolvedValue(mockResponse);

      const request = new Request(
        'http://localhost:3000/answers/favorites?profileId=user123'
      );
      const result = await loader({ request } as LoaderFunctionArgs);

      expect(createAnswersLoader).toHaveBeenCalledWith(
        { request },
        { favorite: true, requiresAuth: true }
      );

      const data = await result.json();
      expect(data).toEqual({
        answers: [{ id: 1 }],
        total: 1,
        requiresProfileId: false,
        profileId: 'user123',
        topicsById: {},
      });
    });
  });

  it('does not expose a write action', async () => {
    const route = await import('~/routes/answers.favorites');
    expect('action' in route).toBe(false);
  });
});
