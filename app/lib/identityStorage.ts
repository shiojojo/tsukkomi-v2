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
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

function removeCookie(key: string) {
  document.cookie = `${encodeURIComponent(key)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

export function getItem(key: string): string | null {
  if (isLocalStorageAvailable()) {
    return window.localStorage.getItem(key);
  }
  return readCookie(key);
}

export function setItem(key: string, value: string) {
  if (isLocalStorageAvailable()) {
    window.localStorage.setItem(key, value);
    // Dispatch custom event for same-tab updates
    window.dispatchEvent(new Event('identity-change'));
    return;
  }
  writeCookie(key, value);
  // Also dispatch for cookie fallback
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('identity-change'));
  }
}

export function removeItem(key: string) {
  if (isLocalStorageAvailable()) {
    window.localStorage.removeItem(key);
    // Dispatch custom event for same-tab updates
    window.dispatchEvent(new Event('identity-change'));
    return;
  }
  removeCookie(key);
  // Also dispatch for cookie fallback
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('identity-change'));
  }
}

export function available() {
  return isLocalStorageAvailable() || typeof document !== 'undefined';
}
