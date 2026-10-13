import { KIND_LABELS, describeGoal } from '@simload/engine';
import type { Scenario } from '../src/features/scenarios';
import { breadcrumbs, renderPage } from './layout';
import { SITE_NAME, absolute, esc } from './site';

const DIFFICULTY: Record<Scenario['difficulty'], string> = {
  'warm-up': 'Warm-up',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

/** How people search for each problem; used for the page title and heading. */
const HEADLINES: Record<string, string> = {
  'url-shortener': 'Design a URL shortener (like TinyURL or bit.ly)',
  'video-cdn': 'Design a video streaming CDN (like YouTube or Netflix)',
  'news-feed': 'Design a news feed (like Facebook or X)',
  'chat-system': 'Design a chat system (like WhatsApp or Slack)',
  typeahead: 'Design search typeahead (autocomplete)',
  'flash-sale': 'Design a ticket flash sale (like Ticketmaster)',
  'rate-limiter': 'Design an API rate limiter',
  payments: 'Design a payment processing system',
  'multi-region': 'Design multi-region failover',
};

export const headline = (s: Scenario) => HEADLINES[s.id] ?? `System design: ${s.name}`;

export const scenarioPath = (s: Scenario) => `/scenarios/${s.id}/`;
/** Deep link that opens the simulator on this scenario. */
export const scenarioAppLink = (s: Scenario) => `/?scenario=${encodeURIComponent(s.id)}`;

const pageTitle = (s: Scenario) => `${headline(s)} · System design practice | ${SITE_NAME}`;

function pageDescription(s: Scenario): string {
  return `${headline(s)}: ${s.summary} Simulate it under load, find the bottleneck and meet the goal in your browser.`;
}

/** A guide page for one scenario: the problem, the goal, the starting architecture and hints. */
export function renderScenarioPage(s: Scenario): string {
  const design = s.build();
  const nodes = design.nodes.filter((n) => n.kind !== 'client');
  const reads = Math.round(design.traffic.readRatio * 100);
  const components = nodes
    .map(
      (n) =>
        `        <li><strong>${esc(n.label)}</strong> (${esc(KIND_LABELS[n.kind])}${
          n.config.instances > 1 ? `, ${n.config.instances} instances` : ''
        })${n.description ? `: ${esc(n.description)}` : ''}</li>`,
    )
    .join('\n');
  const hints = s.hints.map((h) => `        <li>${esc(h)}</li>`).join('\n');
  const chaos = (s.chaos ?? [])
    .map((c) => `${esc(c.label)} at ${c.atS} s for ${c.durationS} s`)
    .join('; ');
  const body = `      <p class="crumbs"><a href="/">Home</a> › <a href="/scenarios/">Scenarios</a> › ${esc(s.name)}</p>
      <p class="kicker">System design scenario</p>
      <h1>${esc(headline(s))}</h1>
      <p><span class="tag">${DIFFICULTY[s.difficulty]}</span></p>
      <p class="lead">${esc(s.summary)}</p>
      <a class="cta" href="${scenarioAppLink(s)}">▶ Simulate this design</a>
      <h2>The goal</h2>
      <p>${esc(describeGoal(s.goal))}.</p>
      <dl class="facts card">
        <dt>Peak load</dt><dd>${s.goal.targetRps.toLocaleString('en-US')} requests per second</dd>
        <dt>Traffic mix</dt><dd>${reads}% reads, ${100 - reads}% writes</dd>
        <dt>p99 latency</dt><dd>under ${s.goal.maxP99Ms} ms</dd>
        <dt>Error rate</dt><dd>under ${(s.goal.maxErrorRate * 100).toFixed(2)}%</dd>${
          chaos ? `\n        <dt>Chaos</dt><dd>${chaos}</dd>` : ''
        }
      </dl>
      <h2>The starting architecture</h2>
      <p>The simulator opens with this design. It is deliberately too weak for the goal: run it and
      watch which component saturates first.</p>
      <ul>
${components}
      </ul>
      <h2>How to approach it</h2>
      <p>The hints unlock one at a time in the app. Try the design yourself before reading them.</p>
      <details class="card">
        <summary>Show the hints</summary>
        <ol>
${hints}
        </ol>
      </details>
      <h2>What the simulator shows you</h2>
      <p>${SITE_NAME} models every component as a queue with real capacity, latency, timeouts and
      retries, so you see utilisation, p50/p99 latency, errors and monthly cost change as you
      scale. Insights name the bottleneck in plain language, and the capacity planner sizes the
      fix. A reference solution that meets the goal is verified by automated tests.</p>
      <a class="cta" href="${scenarioAppLink(s)}">▶ Try it in the simulator</a>
      <p><a href="/scenarios/">← All scenarios</a></p>`;

  return renderPage({
    path: scenarioPath(s),
    title: pageTitle(s),
    description: pageDescription(s),
    body,
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'LearningResource',
        name: headline(s),
        description: s.summary,
        url: absolute(scenarioPath(s)),
        learningResourceType: 'Interactive simulation',
        educationalLevel: DIFFICULTY[s.difficulty],
        teaches: 'System design: scalability, caching, queueing and reliability',
        isAccessibleForFree: true,
        inLanguage: 'en',
        provider: { '@type': 'Organization', name: SITE_NAME, url: absolute('/') },
      },
      breadcrumbs([
        ['Home', '/'],
        ['Scenarios', '/scenarios/'],
        [s.name, scenarioPath(s)],
      ]),
    ],
  });
}

/** The scenario catalogue page, linking to every guide. */
export function renderScenarioIndex(scenarios: readonly Scenario[]): string {
  const cards = scenarios
    .map(
      (s) => `        <article class="card">
          <h2 style="margin-top:0"><a href="${scenarioPath(s)}">${esc(s.name)}</a></h2>
          <p><span class="tag">${DIFFICULTY[s.difficulty]}</span> · ${s.goal.targetRps.toLocaleString('en-US')} req/s</p>
          <p>${esc(s.summary)}</p>
          <p><a href="${scenarioPath(s)}">Read the brief</a> · <a href="${scenarioAppLink(s)}">Simulate it</a></p>
        </article>`,
    )
    .join('\n');
  const body = `      <p class="crumbs"><a href="/">Home</a> › Scenarios</p>
      <h1>System design interview scenarios</h1>
      <p class="lead">${scenarios.length} classic system design problems, from warm-up to advanced.
      Each one starts with an architecture that breaks under load and a pass/fail goal. Scale it,
      add caches, queues and replicas, and watch the simulation tell you whether it holds.</p>
      <div class="grid">
${cards}
      </div>`;
  return renderPage({
    path: '/scenarios/',
    title: `System design interview practice: ${scenarios.length} simulated scenarios | ${SITE_NAME}`,
    description: `Practise system design interviews with ${scenarios.length} interactive scenarios: ${scenarios
      .map((s) => s.name)
      .join(', ')}. Simulate each design under real load in your browser.`,
    body,
    ogType: 'website',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'System design scenarios',
        itemListElement: scenarios.map((s, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: s.name,
          url: absolute(scenarioPath(s)),
        })),
      },
      breadcrumbs([
        ['Home', '/'],
        ['Scenarios', '/scenarios/'],
      ]),
    ],
  });
}
