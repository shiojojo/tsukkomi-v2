import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createListLoader } from '~/lib/loaders';

vi.mock('~/lib/db', () => ({
  getTopicsPaged: vi.fn(),
  searchAnswers: vi.fn(),
}));

describe('createListLoader query parsing integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes answers-specific filters from the query source to searchAnswers', async () => {
    const request = new Request('http://localhost/answers');
    const querySource = new URL(
      'http://localhost/answers?author=&sortBy=newest&q=&minScore=1&fromDate=&toDate='
    );
    const { searchAnswers } = await import('~/lib/db');
    vi.mocked(searchAnswers).mockResolvedValue({ answers: [], total: 0 });

    const response = await createListLoader('answers', request, undefined, querySource);

    expect(searchAnswers).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      q: '',
      author: '',
      sortBy: 'newest',
      minScore: 1,
      hasComments: false,
      fromDate: '',
      toDate: '',
    });
    await expect(response.json()).resolves.toMatchObject({
      total: 0,
      minScore: 1,
      sortBy: 'newest',
    });
  });
});
