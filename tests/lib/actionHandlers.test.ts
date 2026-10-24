import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type ActionFunctionArgs } from 'react-router';
import { handleAnswerActions } from '~/lib/actionHandlers';

// Mock dependencies
vi.mock('~/lib/rateLimiter', () => ({
  consumeRequestToken: vi.fn(),
}));
vi.mock('~/lib/db', () => ({
  toggleFavorite: vi.fn(),
  getFavoritesForProfile: vi.fn(),
  voteAnswer: vi.fn(),
  addComment: vi.fn(),
}));

describe('actionHandlers', () => {
  const profileId = '123e4567-e89b-42d3-a456-426614174000';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleAnswerActions', () => {
    it('should handle toggle favorite', async () => {
      const params = new URLSearchParams();
      params.append('op', 'toggle');
      params.append('answerId', '1');
      params.append('profileId', profileId);
      const request = new Request('http://localhost/answers', { 
        method: 'POST', 
        body: params,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const { consumeRequestToken } = await import('~/lib/rateLimiter');
      const { toggleFavorite } = await import('~/lib/db');
      vi.mocked(consumeRequestToken).mockReturnValue(true);
      vi.mocked(toggleFavorite).mockResolvedValue({ favorited: true });

      const result = await handleAnswerActions({ request } as ActionFunctionArgs);
      expect(toggleFavorite).toHaveBeenCalledWith({ answerId: 1, profileId });
      expect(result).toBeInstanceOf(Response);
    });

    it('should handle vote', async () => {
      const params = new URLSearchParams();
      params.append('level', '1');
      params.append('answerId', '1');
      params.append('userId', profileId);
      const request = new Request('http://localhost/answers', { 
        method: 'POST', 
        body: params,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const { consumeRequestToken } = await import('~/lib/rateLimiter');
      const { voteAnswer } = await import('~/lib/db');
      vi.mocked(consumeRequestToken).mockReturnValue(true);
      vi.mocked(voteAnswer).mockResolvedValue({
        id: 1,
        text: 'Answer',
        created_at: '2023-01-01',
        votes: { level1: 0, level2: 0, level3: 0 },
        votesBy: {},
        profileId,
        topicId: 1,
        favorited: false,
        commentCount: 0
      });

      const result = await handleAnswerActions({ request } as ActionFunctionArgs);
      expect(voteAnswer).toHaveBeenCalledWith({ answerId: 1, level: 1, userId: profileId });
      expect(result).toBeInstanceOf(Response);
    });

    it('should handle comment', async () => {
      const params = new URLSearchParams();
      params.append('answerId', '1');
      params.append('text', 'Test comment');
      params.append('profileId', profileId);
      const request = new Request('http://localhost/answers', { 
        method: 'POST', 
        body: params,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const { consumeRequestToken } = await import('~/lib/rateLimiter');
      const { addComment } = await import('~/lib/db');
      vi.mocked(consumeRequestToken).mockReturnValue(true);
      vi.mocked(addComment).mockResolvedValue({
        id: 1,
        answerId: 1,
        text: 'Test comment',
        profileId,
        created_at: '2023-01-01'
      });

      const result = await handleAnswerActions({ request } as ActionFunctionArgs);
      expect(addComment).toHaveBeenCalledWith({ answerId: 1, text: 'Test comment', profileId });
      expect(result).toBeInstanceOf(Response);
    });

    it('rejects invalid action input before reaching database writes', async () => {
      const params = new URLSearchParams();
      params.append('level', '9');
      params.append('answerId', '-1');
      params.append('userId', 'not-a-uuid');
      const request = new Request('http://localhost/answers', {
        method: 'POST',
        body: params,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const { consumeRequestToken } = await import('~/lib/rateLimiter');
      const { voteAnswer } = await import('~/lib/db');
      vi.mocked(consumeRequestToken).mockReturnValue(true);

      const response = await handleAnswerActions({ request } as ActionFunctionArgs);

      expect(response.status).toBe(400);
      expect(voteAnswer).not.toHaveBeenCalled();
    });
  });
});