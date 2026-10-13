import { SCENARIOS } from '../src/features/scenarios';
import { renderAboutPage } from './aboutPage';
import { renderPage } from './layout';
import { renderScenarioIndex, renderScenarioPage, scenarioPath } from './scenarioPages';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, absolute } from './site';

export interface StaticFile {
  /** Output path relative to the build directory. */
  file: string;
  content: string;
}

/** Support and legal pages (hand-written HTML in public/). */
export const LEGAL_PAGES = ['/support.html', '/privacy.html', '/terms.html'];

/** Site paths listed in the sitemap, most important first. */
export function sitemapPaths(): string[] {
  return ['/', '/scenarios/', ...SCENARIOS.map(scenarioPath), '/about/', ...LEGAL_PAGES];
}

export function renderSitemap(paths: readonly string[], lastmod: string): string {
  const urls = paths
    .map((p) => {
      const priority =
        p === '/' ? '1.0' : p === '/scenarios/' ? '0.9' : LEGAL_PAGES.includes(p) ? '0.3' : '0.7';
      return `  <url><loc>${absolute(p)}</loc><lastmod>${lastmod}</lastmod><priority>${priority}</priority></url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export function renderRobots(): string {
  return `User-agent: *
Allow: /

Sitemap: ${absolute('/sitemap.xml')}
`;
}

/** A plain-text summary for AI assistants and LLM crawlers (llmstxt.org). */
export function renderLlmsTxt(): string {
  const scenarios = SCENARIOS.map(
    (s) => `- [${s.name}](${absolute(scenarioPath(s))}): ${s.summary}`,
  ).join('\n');
  return `# ${SITE_NAME}

> ${SITE_TAGLINE}. ${SITE_DESCRIPTION}

${SITE_NAME} runs entirely in the browser (no backend, no account, works offline). Open a
scenario directly with ${absolute('/?scenario=<id>')}, e.g. ${absolute('/?scenario=url-shortener')}.

## Pages

- [Simulator](${absolute('/')}): the app itself
- [About and FAQ](${absolute('/about/')}): what it does and how the simulation works
- [Scenarios](${absolute('/scenarios/')}): system design interview practice problems

## Scenarios

${scenarios}
`;
}

function render404(): string {
  return renderPage({
    path: '/404.html',
    title: `Page not found | ${SITE_NAME}`,
    description: 'This page does not exist.',
    structuredData: [],
    body: `      <h1>Page not found</h1>
      <p class="lead">That page does not exist. Try the simulator or the scenario guides.</p>
      <a class="cta" href="/">▶ Open the simulator</a>
      <p><a href="/scenarios/">Browse the scenarios</a> · <a href="/about/">About ${SITE_NAME}</a></p>`,
  }).replace(
    '<meta name="robots" content="index, follow, max-image-preview:large" />',
    '<meta name="robots" content="noindex" />',
  );
}

/** Every static SEO file written next to the app at build time. */
export function buildStaticFiles(lastmod = new Date().toISOString().slice(0, 10)): StaticFile[] {
  return [
    { file: 'about/index.html', content: renderAboutPage() },
    { file: 'scenarios/index.html', content: renderScenarioIndex(SCENARIOS) },
    ...SCENARIOS.map((s) => ({
      file: `scenarios/${s.id}/index.html`,
      content: renderScenarioPage(s),
    })),
    { file: '404.html', content: render404() },
    { file: 'sitemap.xml', content: renderSitemap(sitemapPaths(), lastmod) },
    { file: 'robots.txt', content: renderRobots() },
    { file: 'llms.txt', content: renderLlmsTxt() },
  ];
}
