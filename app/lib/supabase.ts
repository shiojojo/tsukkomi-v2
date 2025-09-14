import { createClient } from '@supabase/supabase-js';

// Prefer Vite env names but fall back to process.env for server environments
// Require the URL/key to be provided via env to avoid leaking project-specific URLs in source.
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) ?? process.env.SUPABASE_URL;
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_KEY as string) ?? process.env.SUPABASE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  // Do not throw here to allow dev workflows to continue, but surface an actionable warning.
  // eslint-disable-next-line no-console
  console.warn('Supabase URL or Key is not set. Set VITE_SUPABASE_URL / SUPABASE_URL and VITE_SUPABASE_KEY / SUPABASE_KEY in environment.');
}

export const supabase = createClient(String(SUPABASE_URL ?? ''), SUPABASE_KEY);

export default supabase;

// Connection check caching: avoid repeating a failed network call many times.
let _connectionCheck: true | Promise<void> | null = null;

/**
 * ensureConnection
 * - Throws a clear Error when the SUPABASE key is missing or Supabase is unreachable.
 * - Caches successful checks to avoid repeated probes.
 */
export async function ensureConnection(): Promise<void> {
  if (_connectionCheck === true) return;
  if (_connectionCheck) return _connectionCheck;

  _connectionCheck = (async () => {
    if (!SUPABASE_KEY) throw new Error('Supabase key is not set. Set VITE_SUPABASE_KEY or SUPABASE_KEY');
    try {
      // lightweight probe: attempt to select 1 row from profiles (smallest safe table)
      const { error } = await supabase.from('profiles').select('id').limit(1);
      if (error) throw error;
    } catch (e: any) {
      // normalize error shape for caller
      throw new Error(`Supabase connection check failed: ${e?.message ?? String(e)}`);
    }
  })();

  try {
    await _connectionCheck;
    _connectionCheck = true;
  } catch (err) {
    // keep the rejected promise cached so multiple callers see the same message
    _connectionCheck = _connectionCheck as Promise<void>;
    throw err;
  }
}
