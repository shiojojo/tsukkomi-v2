import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { loader, action } from '~/routes/login';

// Mock db
vi.mock('~/lib/db', () => ({
  getUsers: vi.fn(),
  addSubUser: vi.fn(),
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

  describe('action', () => {
    it('should handle add-subuser intent', async () => {
      const formData = new FormData();
      formData.append('intent', 'add-subuser');
      formData.append('parentId', 'parent1');
      formData.append('name', 'New Sub');
      const mockRequest = new Request('http://localhost/login', {
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

    it('should return error for invalid subuser data', async () => {
      const formData = new FormData();
      formData.append('intent', 'add-subuser');
      formData.append('parentId', '');
      formData.append('name', '');
      const mockRequest = new Request('http://localhost/login', {
        method: 'POST',
        body: formData,
      });

      const result = await action({
        request: mockRequest,
      } as ActionFunctionArgs);
      const data = await result.json();
      expect(data).toHaveProperty('ok', false);
      expect(data).toHaveProperty('errors');
    });
  });
});
