import { breadcrumbs, renderPage } from './layout';
import { REPO_URL, SITE_NAME, esc } from './site';

/** Questions people search for; also emitted as FAQPage structured data. */
export const FAQ: readonly [string, string][] = [
  [
    'What is SimLoad?',
    'SimLoad is a free system design simulator that runs in your browser. You draw an architecture from clients, CDNs, load balancers, services, caches, queues, databases and external APIs, set the traffic from 1 to 100 million requests per second, and watch how queues, latency, errors and cost behave.',
  ],
  [
    'How does the simulation work?',
    'A rate-based flow layer models every component as a queue (M/M/c with backlogs, timeouts, retries and drops), and a sampled-request layer produces p50, p95 and p99 latency and request traces. Runs are deterministic for a given seed, so results are reproducible.',
  ],
  [
    'Can I use it to prepare for system design interviews?',
    'Yes. Prep mode has nine scenarios, including a URL shortener, news feed, chat system, video CDN and payment processing. Each has a pass/fail goal, hints that unlock as you go and a reference solution, so you can practise scaling decisions and see their effect.',
  ],
  [
    'Can I validate a real architecture with it?',
    'Yes. Validate mode lets you calibrate each component from measured p50/p99 latency and capacity, or import load-test results from k6, Gatling, JMeter or CSV, and then test what-if scenarios such as 10x traffic or a zone outage.',
  ],
  [
    'Does it estimate cloud costs?',
    'SimLoad estimates the monthly cost of a design from instance-hours and per-request prices, and compares it on AWS, Azure and Google Cloud on-demand list prices. Storage, backups and discounts are not included, so treat the numbers as estimates.',
  ],
  [
    'Is SimLoad free? Do I need an account?',
    'SimLoad is free and open source under the MIT licence. There is no account and no backend: designs stay in your browser, and you can share them as links or export them as JSON, Markdown or PDF.',
  ],
  [
    'Does it work offline?',
    'Yes. After the first visit the app is cached, so it opens and runs without an internet connection, and you can install it as an app from your browser.',
  ],
];

const FEATURES: readonly [string, string][] = [
  [
    'Realistic load model',
    'Queueing maths, timeouts, retries and retry storms, autoscaling, cold starts, circuit breakers, rate limits and hot-key skew across shards.',
  ],
  [
    'Bottleneck insights',
    'Plain-language explanations of what saturates first and why, with the fix and its effect.',
  ],
  [
    'Capacity planner',
    'Finds the leanest instances, replicas, shards or consumers that meet a goal with headroom, in one click.',
  ],
  [
    'Cloud cost comparison',
    'Monthly cost per component on AWS, Azure and Google Cloud list prices.',
  ],
  [
    'Chaos testing',
    'Kill a node or a whole zone, inject latency or errors, flush a cache, and watch the system recover or cascade.',
  ],
  [
    'Share and export',
    'Compressed share links, Mermaid and draw.io import, Markdown and PDF reports.',
  ],
];

export function renderAboutPage(): string {
  const features = FEATURES.map(
    ([title, text]) =>
      `        <div class="card"><h3 style="margin-top:0">${esc(title)}</h3><p>${esc(text)}</p></div>`,
  ).join('\n');
  const faq = FAQ.map(([q, a]) => `      <h3>${esc(q)}</h3>\n      <p>${esc(a)}</p>`).join('\n');
  const body = `      <p class="crumbs"><a href="/">Home</a> › About</p>
      <p class="kicker">About ${SITE_NAME}</p>
      <h1>A system design simulator for interviews and real architectures</h1>
      <p class="lead">${SITE_NAME} is a wind tunnel for software architecture. Draw a system, push
      traffic from 1 to 100 million requests per second through it and watch queues build, latency
      climb, caches save you and retry storms take you down, live in your browser.</p>
      <a class="cta" href="/">▶ Open the simulator</a>
      <h2>Features</h2>
      <div class="grid">
${features}
      </div>
      <h2>Two ways to use it</h2>
      <h3>Prep mode: system design interview practice</h3>
      <p>Pick one of the <a href="/scenarios/">nine scenarios</a>, run the starting design, read why it
      fails and scale it until it meets the goal.</p>
      <h3>Validate mode: check a real architecture</h3>
      <p>Calibrate components from production measurements or load-test results, then stress the
      design with more traffic, failures and chaos.</p>
      <h2>Frequently asked questions</h2>
${faq}
      <p>${SITE_NAME} is open source: <a href="${REPO_URL}">source code on GitHub</a>.</p>`;
  return renderPage({
    path: '/about/',
    title: `About ${SITE_NAME}: free system design simulator & FAQ`,
    description:
      'What SimLoad is, how its system design simulation works, and answers to common questions about interview practice, validating real architectures, cloud costs and offline use.',
    body,
    ogType: 'website',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQ.map(([q, a]) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
      breadcrumbs([
        ['Home', '/'],
        ['About', '/about/'],
      ]),
    ],
  });
}
