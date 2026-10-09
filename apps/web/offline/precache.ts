import { createHash } from 'node:crypto';

/** Build outputs that are never fetched by the running app. */
const SKIP = [/\.map$/, /^sw\.js$/, /(^|\/)\.[^/]+$/, /^CNAME$/];

/**
 * URLs (relative to the site root) the service worker downloads on install,
 * so the whole app works offline after the first visit. The site root
 * (`./`) stands in for index.html, which is what a navigation receives.
 */
export function precacheList(files: readonly string[]): string[] {
  const kept = files
    .filter((f) => !SKIP.some((re) => re.test(f)))
    .map((f) => (f === 'index.html' ? './' : f));
  return [...new Set(kept)].sort((a, b) => (a === './' ? -1 : b === './' ? 1 : a.localeCompare(b)));
}

/** Changes whenever any precached file name changes (Vite hashes content into names). */
export function precacheVersion(list: readonly string[], salt = ''): string {
  return createHash('sha256').update(salt).update(list.join('\n')).digest('hex').slice(0, 12);
}

/** Fills the service worker template with the cache version and file list. */
export function renderServiceWorker(template: string, list: readonly string[], version: string) {
  return template
    .replace('__SIMLOAD_VERSION__', version)
    .replace('__SIMLOAD_PRECACHE__', JSON.stringify(list));
}
