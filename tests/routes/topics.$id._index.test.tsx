import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RouterContextProvider } from 'react-router';
import { loader } from '~/routes/topics.$id._index';

// Mock db
vi.mock('~/lib/loaders', () => ({
  createAnswersListLoader: vi.fn(),
  createListLoader: vi.fn(),
}));
vi.mock('~/lib/loaders/answersLoader', () => ({
  createAnswersLoader: vi.fn(),
}));
describe('topics.$id._index route', () => {
  const context = new RouterContextProvider();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loader', () => {
    it('should call createAnswersListLoader with topicId from params', async () => {
      const mockResult = new Response(
        JSON.stringify({ answers: [], topicId: '123', topicsById: {} }),
        { status: 200 },
      );
      const { createAnswersLoader } =
        await import('~/lib/loaders/answersLoader');
      vi.mocked(createAnswersLoader).mockResolvedValue(mockResult);

      const request = new Request('http://localhost/topics/123');
      const params = { id: '123' };
      const url = new URL(request.url);
      const result = await loader({
        request,
        params,
        context,
        pattern: '/topics/$id',
        url,
      });

      expect(createAnswersLoader).toHaveBeenCalledWith(
        {
          request,
          params,
          context,
          pattern: '/topics/$id',
          url,
        },
        { topicId: '123' },
      );
      expect(await result.json()).toEqual({
        answers: [],
        topicId: '123',
        topicsById: {},
      });
    });

    it('should handle undefined topicId', async () => {
      const mockResult = new Response(JSON.stringify({ answers: [] }), {
        status: 200,
      });
      const { createAnswersLoader } =
        await import('~/lib/loaders/answersLoader');
      vi.mocked(createAnswersLoader).mockResolvedValue(mockResult);

      const request = new Request('http://localhost/topics/undefined');
      const params = { id: undefined };
      const url = new URL(request.url);
      await loader({
        request,
        params,
        context,
        pattern: '/topics/$id',
        url,
      });

      expect(createAnswersLoader).toHaveBeenCalledWith(
        {
          request,
          params,
          context,
          pattern: '/topics/$id',
          url,
        },
        { topicId: undefined },
      );
    });
  });

  it('does not expose a write action', async () => {
    const route = await import('~/routes/topics.$id._index');
    expect('action' in route).toBe(false);
  });
});
