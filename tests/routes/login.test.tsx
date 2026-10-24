import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { loader, action } from '~/routes/login';

// Mock db
vi.mock('~/lib/db', () => ({
  getUsers: vi.fn(),
  addSubUser: vi.fn(),
}));
vi.mock('~/lib/rateLimiter', () => ({
  consumeRequestToken: vi.fn(() => true),
}));

describe('login route', () => {
  const parentId = '123e4567-e89b-42d3-a456-426614174000';

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
      const mockRequest = new Request('http://localhost/login', {
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

    it('should return error for invalid subuser data', async () => {
      const { consumeRequestToken } = await import('~/lib/rateLimiter');
      vi.mocked(consumeRequestToken).mockReturnValue(true);
      const params = new URLSearchParams();
      params.append('intent', 'add-subuser');
      params.append('parentId', '');
      params.append('name', '');
      const mockRequest = new Request('http://localhost/login', {
        method: 'POST',
        body: params,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const result = await action({
        request: mockRequest,
      } as ActionFunctionArgs);
      const data = await result.json();
      expect(data).toHaveProperty('ok', false);
      expect(data).toHaveProperty('errors');
    });

    it('rate limits subuser creation by requester', async () => {
      const { consumeRequestToken } = await import('~/lib/rateLimiter');
      vi.mocked(consumeRequestToken).mockReturnValue(false);
      const request = new Request('http://localhost/login', { method: 'POST' });

      const response = await action({ request } as ActionFunctionArgs);

      expect(response.status).toBe(429);
    });
  });
});
