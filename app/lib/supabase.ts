import { createClient } from '@supabase/supabase-js';

// Prefer Vite env names but fall back to process.env for server environments
// Require the URL/key to be provided via env to avoid leaking project-specific URLs in source.
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) ?? process.env.SUPABASE_URL;

// Public (anon) key intended to be bundled into client-side code. Only allows reads by RLS rules.
const SUPABASE_PUBLIC_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLIC_KEY as string) ??
  process.env.VITE_SUPABASE_PUBLIC_KEY ??
  process.env.SUPABASE_PUBLIC_KEY ??
  '';

// Secret / service role key must never be bundled into client code. Create server client only when
// running in a server environment (SSR / Node). Prefer process.env on server to avoid leakage.
const isServer = typeof window === 'undefined' || Boolean((import.meta as any).env?.SSR);
const SUPABASE_SECRET_KEY = isServer
  ? (process.env.VITE_SUPABASE_SECRET_KEY ?? process.env.VITE_SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SECRET_KEY ?? import.meta.env.VITE_SUPABASE_SECRET_KEY ?? '')
  : '';

if (!SUPABASE_URL) {
  // eslint-disable-next-line no-console
  console.warn('Supabase URL is not set. Set VITE_SUPABASE_URL / SUPABASE_URL in environment.');
}

// Public client: safe to use on client-side for SELECTs (RLS still applies).
export const supabase = createClient(String(SUPABASE_URL ?? ''), SUPABASE_PUBLIC_KEY);

// Server/admin client: only created on server and only when a secret key is present.
export const supabaseAdmin = isServer && SUPABASE_SECRET_KEY ? createClient(String(SUPABASE_URL ?? ''), SUPABASE_SECRET_KEY) : undefined;

export default supabase;

// Connection check caching: avoid repeating a failed network call many times.
let _connectionCheck: true | Promise<void> | null = null;
// Timeout for the lightweight probe (ms). Keep small so requests fail fast instead of hanging.
const CONNECTION_PROBE_TIMEOUT_MS = 2000;

/**
 * ensureConnection
 * - Throws a clear Error when no usable Supabase key is present or Supabase is unreachable.
 * - Prefers server/admin client when available (used for mutations). Reads can use public client.
 * - Caches successful checks to avoid repeated probes.
 */
export async function ensureConnection(): Promise<void> {
  if (_connectionCheck === true) return;
  if (_connectionCheck) return _connectionCheck;

  const clientToProbe = supabaseAdmin ?? supabase;
  if (!clientToProbe) throw new Error('No Supabase client available (public or secret key missing)');

  // Start a lightweight probe and cache the raced promise so concurrent callers
  // share the same timeout behavior. Caching the raw probe promise caused a
  // situation where a hung probe would be returned to later callers and never
  // time out for them; using the race ensures all callers observe the timeout.
  const probePromise = (async () => {
    try {
      // lightweight probe: attempt to select 1 row from profiles (smallest safe table)
      const { error } = await clientToProbe.from('profiles').select('id').limit(1);
      if (error) throw error;
    } catch (e: any) {
      // normalize error shape for caller
      throw new Error(`Supabase connection check failed: ${e?.message ?? String(e)}`);
    }
  })();

  const timed = Promise.race([
    probePromise,
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Supabase connection probe timed out')), CONNECTION_PROBE_TIMEOUT_MS)
    ),
  ]);

  // Cache the raced promise (not the raw probe) so concurrent callers don't
  // get stuck on the underlying probe if it never resolves.
  _connectionCheck = timed;

  try {
    await timed;
    // mark success so subsequent calls are fast
    _connectionCheck = true;
  } catch (err) {
    // reset so callers can retry later instead of being stuck with a cached rejection
    _connectionCheck = null;
    throw err;
  }
}
