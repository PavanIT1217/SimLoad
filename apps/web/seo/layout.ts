import { OG_IMAGE, SITE_NAME, absolute, esc, jsonLd } from './site';

export interface PageMeta {
  /** Site path with a trailing slash, e.g. `/scenarios/url-shortener/`. */
  path: string;
  title: string;
  description: string;
  /** Structured data objects, each emitted as its own JSON-LD script. */
  structuredData: unknown[];
  /** Main content (already escaped HTML). */
  body: string;
  ogType?: 'website' | 'article';
}

const STYLE = `
:root{color-scheme:dark;--bg:#04070d;--surface:#0b1220;--border:#1d2a3d;--text:#e2e8f0;--muted:#94a3b8;--accent:#22d3ee;--accent2:#a78bfa;--ok:#34d399}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--accent)}
.wrap{max-width:860px;margin:0 auto;padding:0 20px}
header.site{border-bottom:1px solid var(--border)}
header.site .wrap{display:flex;align-items:center;gap:20px;min-height:60px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px;color:var(--text);text-decoration:none;font-weight:700;letter-spacing:.08em}
nav{display:flex;gap:16px;margin-left:auto;font-size:15px}
nav a{color:var(--muted);text-decoration:none}nav a:hover{color:var(--accent)}
.cta{display:inline-block;margin:8px 0;padding:10px 18px;border:1px solid var(--accent);border-radius:6px;background:rgba(34,211,238,.14);color:var(--accent);font-weight:600;text-decoration:none}
.cta:hover{background:var(--accent);color:#04070d}
main{padding:32px 0 48px}
h1{font-size:2rem;line-height:1.25;margin:0 0 12px}
h2{font-size:1.3rem;margin:36px 0 10px}
h3{font-size:1.05rem;margin:20px 0 6px}
.lead{font-size:1.1rem;color:var(--muted)}
.kicker{color:var(--ok);font:600 12px/1 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase}
.card{border:1px solid var(--border);border-radius:8px;background:var(--surface);padding:16px 18px;margin:12px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.tag{display:inline-block;padding:1px 8px;border:1px solid var(--accent2);border-radius:999px;color:var(--accent2);font-size:12px}
dl.facts{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px}dl.facts dt{color:var(--muted)}dl.facts dd{margin:0}
.crumbs{font-size:14px;color:var(--muted)}.crumbs a{color:var(--muted)}
footer{border-top:1px solid var(--border);color:var(--muted);font-size:14px;padding:20px 0 32px}
`;

const LOGO = `<svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#0f172a"/><circle cx="8" cy="16" r="3.5" fill="#38bdf8"/><circle cx="24" cy="9" r="3.5" fill="#34d399"/><circle cx="24" cy="23" r="3.5" fill="#fbbf24"/><path d="M11 15l9.5-5M11 17l9.5 5" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/></svg>`;

/** A complete, standalone HTML document for a static content page. */
export function renderPage(meta: PageMeta): string {
  const url = absolute(meta.path);
  const title = esc(meta.title);
  const description = esc(meta.description);
  const scripts = meta.structuredData
    .map((d) => `<script type="application/ld+json">${jsonLd(d)}</script>`)
    .join('\n    ');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${url}" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="theme-color" content="#04070d" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:type" content="${meta.ogType ?? 'article'}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${OG_IMAGE}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${OG_IMAGE}" />
    ${scripts}
    <style>${STYLE.replace(/\n/g, '')}</style>
  </head>
  <body>
    <header class="site">
      <div class="wrap">
        <a class="brand" href="/">${LOGO}<span>SIM//LOAD</span></a>
        <nav aria-label="Site">
          <a href="/scenarios/">Scenarios</a>
          <a href="/about/">About</a>
          <a href="/">Open the simulator</a>
        </nav>
      </div>
    </header>
    <main class="wrap">
${meta.body}
    </main>
    <footer>
      <div class="wrap">
        ${SITE_NAME} is a free, open-source system design simulator that runs entirely in your
        browser. <a href="/">Open the simulator</a> · <a href="/scenarios/">Scenarios</a> ·
        <a href="/about/">About &amp; FAQ</a> · <a href="/support.html">Support</a> ·
        <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a>
      </div>
    </footer>
  </body>
</html>
`;
}

/** schema.org BreadcrumbList for a trail of [name, path] pairs. */
export function breadcrumbs(trail: [string, string][]): unknown {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map(([name, path], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: absolute(path),
    })),
  };
}
