// Best-effort per-instance token bucket. This slows bursts but is not a
// distributed rate limiter; use Vercel Firewall or shared storage for that.
const _rateBuckets = new Map<string, { tokens: number; lastTs: number }>();
const RATE_CAPACITY = 5; // max burst tokens
const RATE_REFILL_PER_SEC = 1; // tokens refilled per second
const MAX_BUCKETS = 10_000;
const BUCKET_IDLE_TTL_SEC = 60;

export function consumeToken(key: string, cost = 1): boolean {
  if (!key || !Number.isFinite(cost) || cost <= 0) return false;

  const now = Date.now() / 1000;
  let bucket = _rateBuckets.get(key);

  if (!bucket && _rateBuckets.size >= MAX_BUCKETS) {
    for (const [bucketKey, candidate] of _rateBuckets) {
      if (now - candidate.lastTs > BUCKET_IDLE_TTL_SEC) {
        _rateBuckets.delete(bucketKey);
      }
    }
    if (_rateBuckets.size >= MAX_BUCKETS) return false;
  }

  bucket ??= { tokens: RATE_CAPACITY, lastTs: now };
  const elapsed = Math.max(0, now - bucket.lastTs);
  bucket.tokens = Math.min(RATE_CAPACITY, bucket.tokens + elapsed * RATE_REFILL_PER_SEC);
  bucket.lastTs = now;
  if (bucket.tokens < cost) {
    _rateBuckets.set(key, bucket);
    return false;
  }

  bucket.tokens -= cost;
  _rateBuckets.set(key, bucket);
  return true;
}

/** Use Vercel's platform-overwritten requester IP, never a caller-supplied profile ID. */
export function consumeRequestToken(
  request: Request,
  cost = 1,
  namespace = 'default',
): boolean {
  const forwardedIp = request.headers
    .get('x-vercel-forwarded-for')
    ?.split(',')[0]
    .trim();

  return consumeToken(`${namespace}:ip:${forwardedIp || 'unknown'}`, cost);
}
