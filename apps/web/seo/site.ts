const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;

/** Public origin of the deployed site, without a trailing slash (override with VITE_SITE_URL). */
export const SITE_URL = (env?.VITE_SITE_URL ?? 'https://simload.webappslab.com').replace(
  /\/+$/,
  '',
);

export const SITE_NAME = 'SimLoad';
export const SITE_TITLE = 'SimLoad · System Design Simulator';
export const SITE_TAGLINE = 'Simulate system architectures from 1 to 100M requests per second';
export const SITE_DESCRIPTION =
  'Free system design simulator in your browser. Draw an architecture, push traffic from 1 to ' +
  '100M req/s and watch queues, latency, errors and cloud costs. Practise system design ' +
  'interviews with nine scenarios, or validate a real architecture with your own measurements.';
export const OG_IMAGE = `${SITE_URL}/og-image.png`;
export const REPO_URL = 'https://github.com/PavanIT1217/SimLoad';

/** Absolute URL for a site path such as `/scenarios/`. */
export function absolute(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes text for HTML element content and attribute values. */
export function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c);
}

/** Serialises JSON-LD so it is safe inside a <script> element. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
