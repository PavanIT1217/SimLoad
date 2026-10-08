/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defaultServerConditions, defineConfig } from 'vite';

/**
 * GitHub Pages serves project sites from /<repo>/. The deploy workflow runs
 * with GITHUB_REPOSITORY=owner/repo, so derive the base path from it.
 * VITE_BASE overrides it (e.g. for a custom domain).
 */
function basePath(): string {
  if (process.env.VITE_BASE) return process.env.VITE_BASE;
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
  return repo ? `/${repo}/` : '/';
}

const VENDOR_CHUNKS: Record<string, string> = {
  '@xyflow': 'flow',
  recharts: 'charts',
  'd3-': 'charts',
  victory: 'charts',
};

export default defineConfig({
  base: basePath(),
  plugins: [react()],
  resolve: {
    // Consume the engine's TypeScript sources directly (see its package.json exports).
    conditions: ['source', ...defaultClientConditions],
  },
  ssr: {
    // Vitest runs in the SSR environment, which has its own resolve conditions.
    resolve: { conditions: ['source', ...defaultServerConditions] },
  },
  worker: {
    format: 'es',
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const match = /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/.exec(
            id,
          );
          if (!match?.[1]) return undefined;
          const pkg = match[1];
          for (const [prefix, chunk] of Object.entries(VENDOR_CHUNKS)) {
            if (pkg.startsWith(prefix)) return chunk;
          }
          return 'vendor';
        },
      },
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
