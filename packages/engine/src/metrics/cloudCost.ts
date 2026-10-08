import type { Design, NodeConfig } from '../model/types';
import type { TickResult } from '../sim/result';
import { CLOUD_PRICE_LISTS, type CloudPriceList, type CloudProviderId } from './cloudPrices';
import { HOURS_PER_MONTH, billableInstances } from './cost';

const SECONDS_PER_MONTH = HOURS_PER_MONTH * 3600;

export interface CloudNodeCost {
  nodeId: string;
  label: string;
  /** Product the node is priced as; null when it keeps its own prices (external APIs). */
  sku: string | null;
  instances: number;
  monthly: number;
}

export interface CloudCost {
  provider: CloudProviderId;
  name: string;
  region: string;
  nodes: CloudNodeCost[];
  totalMonthly: number;
}

/** Hourly and per-million prices a node would have on a provider. */
export function cloudPrices(
  list: CloudPriceList,
  kind: Design['nodes'][number]['kind'],
  config: NodeConfig,
): Pick<NodeConfig, 'costPerHour' | 'costPerMillion'> & { sku: string | null } {
  const sku = list.skus[kind];
  if (!sku)
    return { sku: null, costPerHour: config.costPerHour, costPerMillion: config.costPerMillion };
  return { sku: sku.sku, costPerHour: sku.perHour, costPerMillion: sku.perMillion };
}

/**
 * Prices the design on each cloud provider: the same billable instances and
 * served traffic as `estimateCost`, but with each provider's list prices for
 * the closest managed offering. External APIs keep their own per-call price.
 */
export function compareCloudCosts(
  design: Design,
  tick?: TickResult | null,
  lists: readonly CloudPriceList[] = CLOUD_PRICE_LISTS,
): CloudCost[] {
  const billable = design.nodes.filter((n) => n.kind !== 'client');
  return lists.map((list) => {
    const nodes = billable.map((node): CloudNodeCost => {
      const live = tick?.nodes[node.id];
      const instances = billableInstances(node, live?.instances);
      const price = cloudPrices(list, node.kind, node.config);
      const usage = ((live?.servedRps ?? 0) * SECONDS_PER_MONTH * price.costPerMillion) / 1e6;
      return {
        nodeId: node.id,
        label: node.label,
        sku: price.sku,
        instances,
        monthly: instances * price.costPerHour * HOURS_PER_MONTH + usage,
      };
    });
    return {
      provider: list.id,
      name: list.name,
      region: list.region,
      nodes,
      totalMonthly: nodes.reduce((s, n) => s + n.monthly, 0),
    };
  });
}

/** Config patches that set every node's prices to a provider's list prices. */
export function cloudPricePatches(
  design: Design,
  provider: CloudProviderId,
): Record<string, Pick<NodeConfig, 'costPerHour' | 'costPerMillion'>> {
  const list = CLOUD_PRICE_LISTS.find((l) => l.id === provider);
  const patches: Record<string, Pick<NodeConfig, 'costPerHour' | 'costPerMillion'>> = {};
  if (!list) return patches;
  for (const node of design.nodes) {
    if (node.kind === 'client' || !list.skus[node.kind]) continue;
    const { costPerHour, costPerMillion } = cloudPrices(list, node.kind, node.config);
    patches[node.id] = { costPerHour, costPerMillion };
  }
  return patches;
}
