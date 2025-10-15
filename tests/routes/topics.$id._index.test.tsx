import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loader, action } from '~/routes/topics.$id._index';

// Mock db
vi.mock('~/lib/loaders', () => ({
  createAnswersListLoader: vi.fn(),
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
      const { createAnswersListLoader } = await import('~/lib/loaders');
      vi.mocked(createAnswersListLoader).mockResolvedValue(mockResult);

      const request = new Request('http://localhost/topics/123');
      const params = { id: '123' };
      const result = await loader({ request, params } as any);

      expect(createAnswersListLoader).toHaveBeenCalledWith(request, {
        topicId: '123',
      });
      expect(result).toBe(mockResult);
    });

    it('should handle undefined topicId', async () => {
      const mockResult = new Response(JSON.stringify({ answers: [] }), {
        status: 200,
      });
      const { createAnswersListLoader } = await import('~/lib/loaders');
      vi.mocked(createAnswersListLoader).mockResolvedValue(mockResult);

      const request = new Request('http://localhost/topics/undefined');
      const params = { id: undefined };
      const result = await loader({ request, params } as any);

      expect(createAnswersListLoader).toHaveBeenCalledWith(request, {
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
      } as any;
      const result = await action(args);

      expect(handleAnswerActions).toHaveBeenCalledWith(args);
      expect(result).toBe(mockResult);
    });
  });
});
