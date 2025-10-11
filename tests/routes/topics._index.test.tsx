import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loader } from '~/routes/topics._index';

// Mock loaders
vi.mock('~/lib/loaders', () => ({
  createListLoader: vi.fn(),
}));

describe('topics._index route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loader', () => {
    it('should call createListLoader with topics', async () => {
      const mockRequest = new Request('http://localhost/topics');
      const mockData = {
        topics: [
          { id: 1, title: 'Test Topic', created_at: '2023-01-01', image: null },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        q: undefined,
        fromDate: undefined,
        toDate: undefined,
      };
      const { createListLoader } = await import('~/lib/loaders');
      const mockResponse = new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      vi.mocked(createListLoader).mockResolvedValue(mockResponse);

      const result = await loader({ request: mockRequest } as any);
      expect(createListLoader).toHaveBeenCalledWith('topics', mockRequest);
      expect(result).toBeInstanceOf(Response);
      const resultData = await result.json();
      expect(resultData).toEqual(mockData);
    });
  });
});
