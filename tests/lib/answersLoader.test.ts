import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { LoaderFunctionArgs } from 'react-router';
import { createAnswersLoader } from '~/lib/loaders/answersLoader';

vi.mock('~/lib/loaders', () => ({
  createListLoader: vi.fn(),
}));

vi.mock('~/lib/db/topics', () => ({
  getTopicsByIds: vi.fn(),
}));

vi.mock('~/lib/db/users', () => ({
  getUsers: vi.fn(),
}));

describe('createAnswersLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the upstream error response instead of masking it with an answers.map error', async () => {
    const { createListLoader } = await import('~/lib/loaders');
    vi.mocked(createListLoader).mockResolvedValue(
      Response.json({ error: 'Admin client required for search operations' }, { status: 500 })
    );

    const response = await createAnswersLoader({
      request: new Request('http://localhost/answers'),
      params: {},
      context: {},
      unstable_pattern: '/answers',
    } as LoaderFunctionArgs);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Admin client required for search operations',
    });
  });

  it('throws a clear bad gateway response when the list payload is malformed', async () => {
    const { createListLoader } = await import('~/lib/loaders');
    vi.mocked(createListLoader).mockResolvedValue(Response.json({ total: 0 }));

    await expect(
      createAnswersLoader({
        request: new Request('http://localhost/answers'),
        params: {},
        context: {},
        unstable_pattern: '/answers',
      } as LoaderFunctionArgs)
    ).rejects.toMatchObject({
      status: 502,
    });
  });
});
