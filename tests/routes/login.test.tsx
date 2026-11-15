import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type LoaderFunctionArgs } from 'react-router';
import { loader } from '~/routes/login';

// Mock db
vi.mock('~/lib/db', () => ({
  getUsers: vi.fn(),
}));

describe('login route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loader', () => {
    it('should return users', async () => {
      const mockUsers = [{ id: '1', name: 'Test User' }];
      const { getUsers } = await import('~/lib/db');
      vi.mocked(getUsers).mockResolvedValue(mockUsers);

      const result = await loader({} as LoaderFunctionArgs);
      expect(result).toBeInstanceOf(Response);
      const resultData = await result.json();
      expect(resultData).toEqual({ users: mockUsers });
      expect(getUsers).toHaveBeenCalled();
    });
  });

  it('does not expose a write action', async () => {
    const route = await import('~/routes/login');
    expect('action' in route).toBe(false);
  });
});
