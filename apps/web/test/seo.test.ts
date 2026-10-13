import { describe, expect, it } from 'vitest';
import { FAQ } from '../seo/aboutPage';
import { buildStaticFiles, sitemapPaths } from '../seo/pages';
import { SITE_URL } from '../seo/site';
import { SCENARIOS } from '../src/features/scenarios';

const files = buildStaticFiles('2026-10-13');
const file = (name: string) => {
  const found = files.find((f) => f.file === name);
  if (!found) throw new Error(`missing ${name}`);
  return found.content;
};
const jsonLdBlocks = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1] ?? 'null'),
  );

describe('SEO static pages', () => {
  it('renders a guide page for every scenario', () => {
    for (const s of SCENARIOS) {
      const html = file(`scenarios/${s.id}/index.html`);
      expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/scenarios/${s.id}/" />`);
      expect(html).toContain(`href="/?scenario=${s.id}"`);
      expect(html.match(/<h1>/g)).toHaveLength(1);
      expect(html).toMatch(/<meta name="description" content="[^"]{80,}"/);
      const types = jsonLdBlocks(html).map((d) => d['@type']);
      expect(types).toEqual(['LearningResource', 'BreadcrumbList']);
    }
  });

  it('escapes text and keeps every page well formed', () => {
    for (const { file: name, content } of files.filter((f) => f.file.endsWith('.html'))) {
      expect(content.startsWith('<!doctype html>'), name).toBe(true);
      expect(content).toContain('<html lang="en">');
      expect(content).toMatch(/<title>[^<]+<\/title>/);
      expect(content).not.toMatch(/<[^>]*undefined/);
    }
  });

  it('marks up the FAQ as structured data', () => {
    const [faq] = jsonLdBlocks(file('about/index.html'));
    expect(faq['@type']).toBe('FAQPage');
    expect(faq.mainEntity).toHaveLength(FAQ.length);
  });

  it('lists every indexable page in the sitemap and links it from robots.txt', () => {
    const sitemap = file('sitemap.xml');
    for (const path of sitemapPaths()) expect(sitemap).toContain(`<loc>${SITE_URL}${path}</loc>`);
    expect(sitemapPaths()).toHaveLength(SCENARIOS.length + 3);
    expect(file('robots.txt')).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
    expect(file('404.html')).toContain('content="noindex"');
  });
});
