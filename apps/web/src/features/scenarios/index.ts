import { chatSystem } from './chatSystem';
import { flashSale } from './flashSale';
import { multiRegion } from './multiRegion';
import { newsFeed } from './newsFeed';
import { payments } from './payments';
import { rateLimiter } from './rateLimiter';
import { describe } from './edit';
import { SCENARIO_NOTES } from './notes';
import type { Scenario } from './types';
import { typeahead } from './typeahead';
import { urlShortener } from './urlShortener';
import { videoCdn } from './videoCdn';

export type { Scenario, ScenarioChaos } from './types';

/** Adds hover descriptions to a scenario's starting design and its reference solution. */
function withNotes(scenario: Scenario): Scenario {
  const notes = SCENARIO_NOTES[scenario.id] ?? {};
  return {
    ...scenario,
    build: () => describe(scenario.build(), notes),
    solution: () => describe(scenario.solution(), notes),
  };
}

export const SCENARIOS: readonly Scenario[] = [
  urlShortener,
  videoCdn,
  newsFeed,
  chatSystem,
  typeahead,
  flashSale,
  rateLimiter,
  payments,
  multiRegion,
].map(withNotes);

export function findScenario(id: string | null): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
