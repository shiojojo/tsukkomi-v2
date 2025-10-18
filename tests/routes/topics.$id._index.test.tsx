import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loader, action } from '~/routes/topics.$id._index';

// Mock db
vi.mock('~/lib/loaders', () => ({
  createAnswersListLoader: vi.fn(),
  createListLoader: vi.fn(),
}));

vi.mock('~/lib/actionHandlers', () => ({
  handleAnswerActions: vi.fn(),
}));

describe('topics.$id._index route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loader', () => {
    it('should call createAnswersListLoader with topicId from params', async () => {
      const mockResult = new Response(JSON.stringify({ answers: [] }), {
        status: 200,
      });
      const { createAnswersListLoader, createListLoader } = await import(
        '~/lib/loaders'
      );
      vi.mocked(createAnswersListLoader).mockResolvedValue(mockResult);
      vi.mocked(createListLoader).mockResolvedValue(mockResult);

      const request = new Request('http://localhost/topics/123');
      const params = { id: '123' };
      const result = await loader({ request, params, context: undefined });

      expect(createListLoader).toHaveBeenCalledWith('answers', request, {
        topicId: '123',
      });
      expect(await result.json()).toEqual({ answers: [], topicId: '123' });
    });

    it('should handle undefined topicId', async () => {
      const mockResult = new Response(JSON.stringify({ answers: [] }), {
        status: 200,
      });
      const { createAnswersListLoader, createListLoader } = await import(
        '~/lib/loaders'
      );
      vi.mocked(createAnswersListLoader).mockResolvedValue(mockResult);
      vi.mocked(createListLoader).mockResolvedValue(mockResult);

      const request = new Request('http://localhost/topics/undefined');
      const params = { id: undefined };
      await loader({ request, params, context: undefined });

      expect(createListLoader).toHaveBeenCalledWith('answers', request, {
        topicId: undefined,
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
        request: new Request('http://localhost/topics/123'),
        params: {},
        context: undefined,
      };
      const result = await action(args);

      expect(handleAnswerActions).toHaveBeenCalledWith(args);
      expect(result).toBe(mockResult);
    });
  });
});
