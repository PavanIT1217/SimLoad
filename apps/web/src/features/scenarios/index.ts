import { chatSystem } from './chatSystem';
import { flashSale } from './flashSale';
import { multiRegion } from './multiRegion';
import { newsFeed } from './newsFeed';
import { payments } from './payments';
import { rateLimiter } from './rateLimiter';
import type { Scenario } from './types';
import { typeahead } from './typeahead';
import { urlShortener } from './urlShortener';
import { videoCdn } from './videoCdn';

export type { Scenario, ScenarioChaos } from './types';

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
];

export function findScenario(id: string | null): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
