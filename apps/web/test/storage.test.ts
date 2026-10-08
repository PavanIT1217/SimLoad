import { afterEach, describe, expect, it } from 'vitest';
import { readStorage } from '../src/features/persistence/storage';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe('storage migration from the old name', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('reads and migrates values saved under syssim: keys', () => {
    const storage = new MemoryStorage();
    storage.setItem('syssim:theme', 'light');
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
    expect(readStorage('simload:theme')).toBe('light');
    expect(storage.getItem('simload:theme')).toBe('light');
  });

  it('prefers the new key once it exists', () => {
    const storage = new MemoryStorage();
    storage.setItem('syssim:theme', 'light');
    storage.setItem('simload:theme', 'dark');
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
    expect(readStorage('simload:theme')).toBe('dark');
  });
});
