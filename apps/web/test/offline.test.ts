import { describe, expect, it } from 'vitest';
import { precacheList, precacheVersion, renderServiceWorker } from '../offline/precache';

describe('offline precache', () => {
  const files = [
    'index.html',
    'assets/index-abc.js',
    'assets/index-abc.js.map',
    'assets/simulation.worker-def.js',
    'assets/font.woff2',
    'favicon.svg',
    'manifest.webmanifest',
    'sw.js',
    '.nojekyll',
    'favicon.svg',
  ];

  it('caches every runtime file once, with the app shell first', () => {
    expect(precacheList(files)).toEqual([
      './',
      'assets/font.woff2',
      'assets/index-abc.js',
      'assets/simulation.worker-def.js',
      'favicon.svg',
      'manifest.webmanifest',
    ]);
  });

  it('changes version when the build output changes', () => {
    const a = precacheList(files);
    const b = precacheList([...files, 'assets/index-xyz.js']);
    expect(precacheVersion(a)).toBe(precacheVersion([...a]));
    expect(precacheVersion(a)).not.toBe(precacheVersion(b));
  });

  it('fills in the service worker template', () => {
    const sw = renderServiceWorker(
      "const VERSION = '__SIMLOAD_VERSION__';\nconst PRECACHE = __SIMLOAD_PRECACHE__;",
      ['./', 'a.js'],
      'v1',
    );
    expect(sw).toBe('const VERSION = \'v1\';\nconst PRECACHE = ["./","a.js"];');
  });
});
