import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loader, action } from '~/routes/answers.favorites';

// Mock db
vi.mock('~/lib/loaders', () => ({
  createAnswersListLoader: vi.fn(),
}));

vi.mock('~/lib/actionHandlers', () => ({
  handleAnswerActions: vi.fn(),
}));

describe('answers.favorites route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loader', () => {
    it('should return default data when profileId is not provided', async () => {
      const request = new Request('http://localhost:3000/answers/favorites');
      const result = await loader({ request } as any);

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
        topicsById: {},
        commentsByAnswer: {},
        users: [],
        requiresProfileId: true,
        profileId: null,
      });
    });

    it('should call createAnswersListLoader with correct params when profileId is provided', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          answers: [{ id: 1 }],
          total: 1,
        }),
      };
      const { createAnswersListLoader } = await import('~/lib/loaders');
      vi.mocked(createAnswersListLoader).mockResolvedValue(mockResponse as any);

      const request = new Request(
        'http://localhost:3000/answers/favorites?profileId=user123'
      );
      const result = await loader({ request } as any);

      expect(createAnswersListLoader).toHaveBeenCalledWith(request, {
        favorite: true,
        profileId: 'user123',
      });

      const data = await result.json();
      expect(data).toEqual({
        answers: [{ id: 1 }],
        total: 1,
        requiresProfileId: false,
        profileId: 'user123',
      });
    });
  });

  describe('action', () => {
    it('should call handleAnswerActions with args', async () => {
      const mockResult = new Response(JSON.stringify({ success: true }), {
        status: 200,
      });
      const { handleAnswerActions } = await import('~/lib/actionHandlers');
      vi.mocked(handleAnswerActions).mockResolvedValue(mockResult);

      const args = {
        request: new Request('http://localhost:3000/answers/favorites'),
      } as any;
      const result = await action(args);

      expect(handleAnswerActions).toHaveBeenCalledWith(args);
      expect(result).toBe(mockResult);
    });
  });
});
