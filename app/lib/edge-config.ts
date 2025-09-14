/**
 * getEdgeNumber
 * - Production: attempts to read a numeric value from Vercel Edge Config by key via dynamic import.
 * - Dev: returns provided fallback immediately to avoid network calls.
 * - On error or missing value: returns fallback.
 */
export async function getEdgeNumber(key: string, fallback: number): Promise<number> {
  if (Boolean(import.meta.env.DEV)) return fallback;
  try {
    // Use Function-based dynamic import to avoid bundler statically resolving the module
    const dynamicImport: (m: string) => Promise<any> = new Function('m', 'return import(m)') as any;
    const mod = await dynamicImport('@vercel/edge-config');
    const v = await (mod.get as any)(key);
    if (v == null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export async function getEdgeValue<T = any>(key: string, fallback?: T): Promise<T | undefined> {
  if (Boolean(import.meta.env.DEV)) return fallback;
  try {
    const dynamicImport: (m: string) => Promise<any> = new Function('m', 'return import(m)') as any;
    const mod = await dynamicImport('@vercel/edge-config');
    const v = await (mod.get as any)(key);
    return (v ?? fallback) as T | undefined;
  } catch {
    return fallback;
  }
}
