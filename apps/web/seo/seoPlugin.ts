import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createServer, type Plugin } from 'vite';
import type { StaticFile } from './pages';

/**
 * After the app is built, renders the static SEO pages (about, scenario
 * guides, 404) plus sitemap.xml, robots.txt and llms.txt into the output
 * directory. The pages reuse the app's scenario data, loaded through Vite's
 * SSR module loader so TypeScript and workspace imports resolve as in the app.
 */
export function seoPlugin(): Plugin {
  let root = '';
  let outDir = '';
  return {
    name: 'simload-seo',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const server = await createServer({
        root,
        configFile: resolve(root, 'vite.config.ts'),
        logLevel: 'error',
        server: { middlewareMode: true, hmr: false, watch: null },
        appType: 'custom',
      });
      try {
        const pages = (await server.ssrLoadModule('/seo/pages.ts')) as {
          buildStaticFiles(): StaticFile[];
        };
        for (const { file, content } of pages.buildStaticFiles()) {
          const target = resolve(outDir, file);
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, content);
        }
      } finally {
        await server.close();
      }
    },
  };
}
