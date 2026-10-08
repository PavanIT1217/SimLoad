/**
 * localStorage access that never throws: storage can be unavailable
 * (private mode, quota exceeded, sandboxed iframes) and the app must keep working.
 */
export function readStorage(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): boolean {
  try {
    globalThis.localStorage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // Ignore: nothing to clean up if storage is unavailable.
  }
}
