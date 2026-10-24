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
  consumeRequestToken: vi.fn(),
}));

vi.mock('~/lib/identityStorage', () => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));

describe('me route', () => {
  const parentId = '123e4567-e89b-42d3-a456-426614174000';
  const subId = '123e4567-e89b-42d3-a456-426614174001';

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
      const { consumeRequestToken } = await import('~/lib/rateLimiter');
      vi.mocked(consumeRequestToken).mockReturnValue(true);

      const params = new URLSearchParams();
      params.append('intent', 'add-subuser');
      params.append('parentId', parentId);
      params.append('name', 'New Sub');
      const mockRequest = new Request('http://localhost/me', {
        method: 'POST',
        body: params,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const mockSub = { id: 'sub1', name: 'New Sub' };
      const { addSubUser } = await import('~/lib/db');
      vi.mocked(addSubUser).mockResolvedValue(mockSub);

      const result = await action({
        request: mockRequest,
      } as ActionFunctionArgs);
      expect(addSubUser).toHaveBeenCalledWith({
        parentId,
        name: 'New Sub',
      });
      const data = await result.json();
      expect(data).toEqual({ ok: true, sub: mockSub, parentId });
    });

    it('should handle remove-subuser intent', async () => {
      const { consumeRequestToken } = await import('~/lib/rateLimiter');
      vi.mocked(consumeRequestToken).mockReturnValue(true);

      const params = new URLSearchParams();
      params.append('intent', 'remove-subuser');
      params.append('parentId', parentId);
      params.append('subId', subId);
      const mockRequest = new Request('http://localhost/me', {
        method: 'POST',
        body: params,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const { removeSubUser } = await import('~/lib/db');
      vi.mocked(removeSubUser).mockResolvedValue(undefined);

      const result = await action({
        request: mockRequest,
      } as ActionFunctionArgs);
      expect(removeSubUser).toHaveBeenCalledWith({ id: subId, parentId });
      const data = await result.json();
      expect(data).toEqual({ parentId, subId });
    });

    it('should return rate limited error', async () => {
      const { consumeRequestToken } = await import('~/lib/rateLimiter');
      vi.mocked(consumeRequestToken).mockReturnValue(false);

      const params = new URLSearchParams();
      params.append('intent', 'add-subuser');
      const mockRequest = new Request('http://localhost/me', {
        method: 'POST',
        body: params,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
