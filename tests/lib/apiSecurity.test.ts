import { describe, expect, it } from 'vitest';
import { matchesApiKey, readJsonBody } from '~/lib/apiSecurity';

describe('API security helpers', () => {
  it('matches exact shared API keys and rejects missing or different keys', () => {
    expect(matchesApiKey('shared-key', 'shared-key')).toBe(true);
    expect(matchesApiKey('shared-key', 'different-key')).toBe(false);
    expect(matchesApiKey('shared-key', null)).toBe(false);
  });

  it('parses JSON bodies within the byte limit', async () => {
    const request = new Request('https://example.com/api', {
      method: 'POST',
      body: JSON.stringify({ ok: true }),
    });

    await expect(readJsonBody(request, 32)).resolves.toEqual({
      kind: 'ok',
      value: { ok: true },
    });
  });

  it('rejects oversized bodies based on content length', async () => {
    const request = new Request('https://example.com/api', {
      method: 'POST',
      headers: { 'content-length': '100' },
      body: '{}',
    });

    await expect(readJsonBody(request, 16)).resolves.toEqual({ kind: 'too-large' });
  });

  it('rejects oversized streamed bodies without content length', async () => {
    const request = new Request('https://example.com/api', {
      method: 'POST',
      body: JSON.stringify({ payload: 'this is longer than the allowed limit' }),
    });

    await expect(readJsonBody(request, 8)).resolves.toEqual({ kind: 'too-large' });
  });

  it('rejects malformed JSON and empty bodies', async () => {
    const malformed = new Request('https://example.com/api', {
      method: 'POST',
      body: '{',
    });
    const empty = new Request('https://example.com/api', { method: 'POST' });

    await expect(readJsonBody(malformed)).resolves.toEqual({ kind: 'invalid' });
    await expect(readJsonBody(empty)).resolves.toEqual({ kind: 'invalid' });
  });
});