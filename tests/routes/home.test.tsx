import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loader, meta } from '~/routes/home';

// Mock db
vi.mock('~/lib/db', () => ({
  getLatestTopic: vi.fn(),
}));

describe('home route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('meta', () => {
    it('should return correct meta tags', () => {
      const result = meta({} as any);

      expect(result).toEqual([
        { title: 'New React Router App' },
        { name: 'description', content: 'Welcome to React Router!' },
      ]);
    });
  });

  describe('loader', () => {
    it('should call getLatestTopic and return the result', async () => {
      const mockTopic = {
        id: '1',
        title: 'Test Topic',
        created_at: '2024-01-01T00:00:00Z',
      };
      const { getLatestTopic } = await import('~/lib/db');
      vi.mocked(getLatestTopic).mockResolvedValue(mockTopic);

      const result = await loader({} as any);
      const data = await result.json();

      expect(getLatestTopic).toHaveBeenCalledTimes(1);
      expect(data).toEqual({ latest: mockTopic });
    });
  });
});
