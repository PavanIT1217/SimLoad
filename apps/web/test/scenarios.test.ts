import {
  createEdge,
  createGoalTracker,
  createNode,
  createSimulation,
  hasErrors,
  validateDesign,
} from '@syssim/engine';
import type { Design, GoalStatus, NodeConfig } from '@syssim/engine';
import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../src/features/scenarios';
import { flashSale } from '../src/features/scenarios/flashSale';
import { newsFeed } from '../src/features/scenarios/newsFeed';
import { urlShortener } from '../src/features/scenarios/urlShortener';
import type { Scenario } from '../src/features/scenarios/types';

const SIM_SECONDS = 150;

function evaluate(scenario: Scenario, design: Design): GoalStatus {
  const sim = createSimulation(design, { samplesPerTick: 100 });
  const tracker = createGoalTracker(scenario.goal);
  let status = tracker.status();
  let verdict: GoalStatus | null = null;
  for (let i = 0; i < SIM_SECONDS * 10; i++) {
    status = tracker.observe(sim.step());
    // Keep the first verdict reached; later off-peak ticks reset the window.
    if (status.state !== 'pending' && !verdict) verdict = status;
  }
  return verdict ?? status;
}

function tune(design: Design, id: string, patch: Partial<NodeConfig>): void {
  const node = design.nodes.find((n) => n.id === id);
  if (!node) throw new Error(`missing ${id}`);
  node.config = { ...node.config, ...patch };
}

/** Inserts `node` on the edge source -> target. */
function insertBetween(
  design: Design,
  source: string,
  target: string,
  node: Design['nodes'][number],
) {
  design.edges = design.edges.filter((e) => !(e.source === source && e.target === target));
  design.nodes.push(node);
  design.edges.push(createEdge(source, node.id), createEdge(node.id, target));
}

describe('built-in scenarios', () => {
  it.each(SCENARIOS)('$name starts from a valid design', (scenario) => {
    expect(hasErrors(validateDesign(scenario.build()))).toBe(false);
  });

  it.each(SCENARIOS)('$name starting design misses its goal', (scenario) => {
    expect(evaluate(scenario, scenario.build()).state).toBe('fail');
  });

  it('URL shortener is solvable with a cache, replicas and more API instances', () => {
    const design = urlShortener.build();
    tune(design, 'api', { instances: 300 });
    tune(design, 'db', { replicas: 5 });
    insertBetween(
      design,
      'api',
      'db',
      createNode('cache', 'cache', { x: 0, y: 0 }, { hitRatio: 0.95, instances: 20 }),
    );
    expect(evaluate(urlShortener, design).state).toBe('pass');
  });

  it('News feed is solvable by scaling the feed service and ranking API', () => {
    const design = newsFeed.build();
    tune(design, 'feed', { instances: 80 });
    tune(design, 'rank', { instances: 30 });
    expect(evaluate(newsFeed, design).state).toBe('pass');
  });

  it('Flash sale is solvable with a queue in front of the database', () => {
    const design = flashSale.build();
    insertBetween(
      design,
      'booking',
      'db',
      createNode('queue', 'queue', { x: 0, y: 0 }, { consumerRps: 30_000, maxQueue: 50_000_000 }),
    );
    expect(evaluate(flashSale, design).state).toBe('pass');
  });
});
