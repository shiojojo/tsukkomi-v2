// edge-config helper removed: returns immediate fallbacks to avoid any network/imports.
export async function getEdgeNumber(_key: string, fallback: number): Promise<number> {
  return fallback;
}

export async function getEdgeValue<T = any>(_key: string, fallback?: T): Promise<T | undefined> {
  return fallback;
}
