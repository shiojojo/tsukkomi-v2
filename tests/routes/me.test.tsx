import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { loader, action } from '~/routes/me';

// Mock db
vi.mock('~/lib/db', () => ({
  getUsers: vi.fn(),
  addSubUser: vi.fn(),
  removeSubUser: vi.fn(),
}));

vi.mock('~/lib/rateLimiter', () => ({
  consumeToken: vi.fn(),
}));

vi.mock('~/lib/identityStorage', () => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));

describe('me route', () => {
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

  describe('action', () => {
    it('should handle add-subuser intent', async () => {
      const { consumeToken } = await import('~/lib/rateLimiter');
      vi.mocked(consumeToken).mockReturnValue(true);

      const formData = new FormData();
      formData.append('intent', 'add-subuser');
      formData.append('parentId', 'parent1');
      formData.append('name', 'New Sub');
      const mockRequest = new Request('http://localhost/me', {
        method: 'POST',
        body: formData,
      });
      const mockSub = { id: 'sub1', name: 'New Sub' };
      const { addSubUser } = await import('~/lib/db');
      vi.mocked(addSubUser).mockResolvedValue(mockSub);

      const result = await action({
        request: mockRequest,
      } as ActionFunctionArgs);
      expect(addSubUser).toHaveBeenCalledWith({
        parentId: 'parent1',
        name: 'New Sub',
      });
      const data = await result.json();
      expect(data).toEqual({ ok: true, sub: mockSub, parentId: 'parent1' });
    });

    it('should handle remove-subuser intent', async () => {
      const { consumeToken } = await import('~/lib/rateLimiter');
      vi.mocked(consumeToken).mockReturnValue(true);

      const formData = new FormData();
      formData.append('intent', 'remove-subuser');
      formData.append('parentId', 'parent1');
      formData.append('subId', 'sub1');
      const mockRequest = new Request('http://localhost/me', {
        method: 'POST',
        body: formData,
      });
      const { removeSubUser } = await import('~/lib/db');
      vi.mocked(removeSubUser).mockResolvedValue(true);

      const result = await action({
        request: mockRequest,
      } as ActionFunctionArgs);
      expect(removeSubUser).toHaveBeenCalledWith('parent1', 'sub1');
      const data = await result.json();
      expect(data).toEqual({ ok: true, parentId: 'parent1', subId: 'sub1' });
    });

    it('should return rate limited error', async () => {
      const { consumeToken } = await import('~/lib/rateLimiter');
      vi.mocked(consumeToken).mockReturnValue(false);

      const formData = new FormData();
      formData.append('intent', 'add-subuser');
      const mockRequest = new Request('http://localhost/me', {
        method: 'POST',
        body: formData,
      });

      const result = await action({
        request: mockRequest,
      } as ActionFunctionArgs);
      expect(result.status).toBe(429);
      const data = await result.json();
      expect(data).toEqual({ ok: false, error: 'rate_limited' });
    });
  });
});
