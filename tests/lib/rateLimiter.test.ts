import { describe, expect, it } from 'vitest';
import { consumeRequestToken, consumeToken } from '~/lib/rateLimiter';

describe('rate limiter', () => {
  it('limits by Vercel-provided requester IP', () => {
    const request = new Request('https://example.com/action', {
      headers: { 'x-vercel-forwarded-for': '198.51.100.10, 10.0.0.1' },
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(consumeRequestToken(request)).toBe(true);
    }
    expect(consumeRequestToken(request)).toBe(false);
  });

  it('does not trust a caller-provided x-forwarded-for value', () => {
    const requestA = new Request('https://example.com/action', {
      headers: { 'x-forwarded-for': '198.51.100.20' },
    });
    const requestB = new Request('https://example.com/action', {
      headers: { 'x-forwarded-for': '198.51.100.21' },
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(consumeRequestToken(requestA)).toBe(true);
    }
    expect(consumeRequestToken(requestB)).toBe(false);
  });

  it('fails closed for invalid limiter inputs', () => {
    expect(consumeToken('', 1)).toBe(false);
    expect(consumeToken('test-invalid-cost', 0)).toBe(false);
  });
});
