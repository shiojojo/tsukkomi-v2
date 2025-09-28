import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loader } from '~/routes/_index';

// Mock db
vi.mock('~/lib/db', () => ({
  getLatestTopic: vi.fn(),
}));

describe('_index route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loader', () => {
    it('should return latest topic', async () => {
      const mockTopic = {
        id: 1,
        title: 'Latest Topic',
        created_at: '2023-01-01',
      };
      const { getLatestTopic } = await import('~/lib/db');
      vi.mocked(getLatestTopic).mockResolvedValue(mockTopic);

      const result = await loader({} as any);
      expect(result).toEqual({ latest: mockTopic });
      expect(getLatestTopic).toHaveBeenCalled();
    });

    it('should handle null latest topic', async () => {
      const { getLatestTopic } = await import('~/lib/db');
      vi.mocked(getLatestTopic).mockResolvedValue(null);

      const result = await loader({} as any);
      expect(result).toEqual({ latest: null });
    });
  });
});
