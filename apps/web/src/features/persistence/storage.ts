/** Key prefix used before the app was renamed from SysSim to SimLoad. */
const LEGACY_PREFIX = 'syssim:';
const PREFIX = 'simload:';

/**
 * localStorage access that never throws: storage can be unavailable
 * (private mode, quota exceeded, sandboxed iframes) and the app must keep working.
 */
export function readStorage(key: string): string | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const value = storage.getItem(key);
    if (value !== null || !key.startsWith(PREFIX)) return value;
    // One-time migration of data saved under the old name.
    const legacy = storage.getItem(LEGACY_PREFIX + key.slice(PREFIX.length));
    if (legacy !== null) storage.setItem(key, legacy);
    return legacy;
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
