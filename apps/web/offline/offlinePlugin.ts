import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';
import { precacheList, precacheVersion, renderServiceWorker } from './precache';

function listFiles(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path, root) : [relative(root, path)];
  });
}

/**
 * Emits `sw.js` next to index.html: a service worker that precaches every
 * file of this build (bundles, workers, fonts, icons) so SimLoad opens and
 * runs without a network connection after the first visit.
 */
export function offlinePlugin(): Plugin {
  let publicDir = '';
  return {
    name: 'simload-offline',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      // index.html is emitted by Vite's HTML plugin, which may run after this hook.
      const files = [
        'index.html',
        ...Object.keys(bundle),
        ...(publicDir ? listFiles(publicDir) : []),
      ];
      const list = precacheList(files.map((f) => f.split('\\').join('/')));
      const template = readFileSync(new URL('./sw.template.js', import.meta.url), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: renderServiceWorker(template, list, precacheVersion(list, template)),
      });
    },
  };
}
