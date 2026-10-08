import { flashSale } from './flashSale';
import { newsFeed } from './newsFeed';
import type { Scenario } from './types';
import { urlShortener } from './urlShortener';

export type { Scenario } from './types';

export const SCENARIOS: readonly Scenario[] = [urlShortener, newsFeed, flashSale];

export function findScenario(id: string | null): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
