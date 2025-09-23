// Lightweight in-memory token-bucket rate limiter.
// Keyed by an arbitrary string (profileId / ip / anon).
// This implementation is intentionally simple and in-memory. For multi-process
// deployments replace with a centralized store (Redis/memcached) implementation.
const _rateBuckets = new Map<string, { tokens: number; lastTs: number }>();
const RATE_CAPACITY = 5; // max burst tokens
const RATE_REFILL_PER_SEC = 1; // tokens refilled per second

export function consumeToken(key: string, cost = 1): boolean {
  try {
    const now = Date.now() / 1000; // seconds
    const b = _rateBuckets.get(key) ?? { tokens: RATE_CAPACITY, lastTs: now };
    const elapsed = Math.max(0, now - b.lastTs);
    b.tokens = Math.min(RATE_CAPACITY, b.tokens + elapsed * RATE_REFILL_PER_SEC);
    b.lastTs = now;
    if (b.tokens >= cost) {
      b.tokens -= cost;
      _rateBuckets.set(key, b);
      return true;
    }
    _rateBuckets.set(key, b);
    return false;
  } catch {
    // fail-open on unexpected errors
    return true;
  }
}

export function inspectBucket(key: string) {
  return _rateBuckets.get(key) ?? { tokens: RATE_CAPACITY, lastTs: Date.now() / 1000 };
}
