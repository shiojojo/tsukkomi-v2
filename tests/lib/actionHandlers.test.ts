import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type ActionFunctionArgs } from 'react-router';
import { handleAnswerActions } from '~/lib/actionHandlers';

// Mock dependencies
vi.mock('~/lib/rateLimiter', () => ({
  consumeToken: vi.fn(),
}));
vi.mock('~/lib/logger', () => ({
  logger: { debug: vi.fn() },
}));
vi.mock('~/lib/db', () => ({
  toggleFavorite: vi.fn(),
  getFavoritesForProfile: vi.fn(),
  voteAnswer: vi.fn(),
  addComment: vi.fn(),
}));

describe('actionHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleAnswerActions', () => {
    it('should handle toggle favorite', async () => {
      const params = new URLSearchParams();
      params.append('op', 'toggle');
      params.append('answerId', '1');
      params.append('profileId', 'user1');
      const request = new Request('http://localhost/answers', { 
        method: 'POST', 
        body: params,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const { consumeToken } = await import('~/lib/rateLimiter');
      const { toggleFavorite } = await import('~/lib/db');
      vi.mocked(consumeToken).mockResolvedValue(true);
      vi.mocked(toggleFavorite).mockResolvedValue({ favorited: true });

      const result = await handleAnswerActions({ request } as ActionFunctionArgs);
      expect(toggleFavorite).toHaveBeenCalledWith({ answerId: 1, profileId: 'user1' });
      expect(result).toBeInstanceOf(Response);
    });

    it('should handle vote', async () => {
      const params = new URLSearchParams();
      params.append('level', '1');
      params.append('answerId', '1');
      params.append('userId', 'user1');
      const request = new Request('http://localhost/answers', { 
        method: 'POST', 
        body: params,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const { consumeToken } = await import('~/lib/rateLimiter');
      const { voteAnswer } = await import('~/lib/db');
      vi.mocked(consumeToken).mockResolvedValue(true);
      vi.mocked(voteAnswer).mockResolvedValue({
        id: 1,
        text: 'Answer',
        created_at: '2023-01-01',
        votes: { level1: 0, level2: 0, level3: 0 },
        votesBy: {},
        profileId: 'user1',
        topicId: 1,
        favorited: false,
        commentCount: 0
      });

      const result = await handleAnswerActions({ request } as ActionFunctionArgs);
      expect(voteAnswer).toHaveBeenCalledWith({ answerId: 1, level: 1, userId: 'user1' });
      expect(result).toBeInstanceOf(Response);
    });

    it('should handle comment', async () => {
      const params = new URLSearchParams();
      params.append('answerId', '1');
      params.append('text', 'Test comment');
      params.append('profileId', 'user1');
      const request = new Request('http://localhost/answers', { 
        method: 'POST', 
        body: params,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const { consumeToken } = await import('~/lib/rateLimiter');
      const { addComment } = await import('~/lib/db');
      vi.mocked(consumeToken).mockResolvedValue(true);
      vi.mocked(addComment).mockResolvedValue({
        id: 1,
        answerId: 1,
        text: 'Test comment',
        profileId: 'user1',
        created_at: '2023-01-01'
      });

      const result = await handleAnswerActions({ request } as ActionFunctionArgs);
      expect(addComment).toHaveBeenCalledWith({ answerId: '1', text: 'Test comment', profileId: 'user1' });
      expect(result).toBeInstanceOf(Response);
    });
  });
});