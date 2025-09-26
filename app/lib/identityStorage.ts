// Fallback storage helper: prefer localStorage, fall back to cookies when unavailable.
function isLocalStorageAvailable() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const key = '__storage_test__';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function readCookie(key: string) {
  try {
    const m = document.cookie.match(new RegExp('(?:^|; )' + encodeURIComponent(key) + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}

function writeCookie(key: string, value: string, days = 365) {
  try {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
  } catch {}
}

function removeCookie(key: string) {
  try {
    document.cookie = `${encodeURIComponent(key)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  } catch {}
}

export function getItem(key: string): string | null {
  if (isLocalStorageAvailable()) {
    try { return window.localStorage.getItem(key); } catch {}
  }
  return readCookie(key);
}

export function setItem(key: string, value: string) {
  if (isLocalStorageAvailable()) {
    try { window.localStorage.setItem(key, value); return; } catch {}
  }
  writeCookie(key, value);
}

export function removeItem(key: string) {
  if (isLocalStorageAvailable()) {
    try { window.localStorage.removeItem(key); return; } catch {}
  }
  removeCookie(key);
}

export function available() {
  return isLocalStorageAvailable() || typeof document !== 'undefined';
}
