import type { Design, DesignNode } from '../model/types';
import type { TickResult } from '../sim/result';

export const HOURS_PER_MONTH = 730;
const SECONDS_PER_MONTH = HOURS_PER_MONTH * 3600;

export interface NodeCost {
  nodeId: string;
  label: string;
  /** Billable instances (primaries + replicas across shards for databases). */
  instances: number;
  fixedMonthly: number;
  usageMonthly: number;
  monthly: number;
}

export interface CostBreakdown {
  nodes: NodeCost[];
  fixedMonthly: number;
  usageMonthly: number;
  totalMonthly: number;
  totalHourly: number;
}

/** Instances you pay for, using the live (autoscaled) count when available. */
export function billableInstances(node: DesignNode, liveInstances?: number): number {
  const cfg = node.config;
  if (node.kind === 'client') return 0;
  const instances = liveInstances ?? cfg.instances;
  if (node.kind === 'database') {
    return (
      (instances + Math.max(0, Math.floor(cfg.replicas))) * Math.max(1, Math.floor(cfg.shards))
    );
  }
  return instances;
}

/**
 * Monthly cost estimate: instance-hours plus per-request charges. With a
 * tick, live instance counts and served traffic are used; without one, only
 * the provisioned (fixed) cost is counted.
 */
export function estimateCost(design: Design, tick?: TickResult | null): CostBreakdown {
  const nodes: NodeCost[] = design.nodes
    .filter((n) => n.kind !== 'client')
    .map((node) => {
      const live = tick?.nodes[node.id];
      const instances = billableInstances(node, live?.instances);
      const fixedMonthly = instances * node.config.costPerHour * HOURS_PER_MONTH;
      const usageMonthly =
        ((live?.servedRps ?? 0) * SECONDS_PER_MONTH * node.config.costPerMillion) / 1e6;
      return {
        nodeId: node.id,
        label: node.label,
        instances,
        fixedMonthly,
        usageMonthly,
        monthly: fixedMonthly + usageMonthly,
      };
    });
  const fixedMonthly = nodes.reduce((s, n) => s + n.fixedMonthly, 0);
  const usageMonthly = nodes.reduce((s, n) => s + n.usageMonthly, 0);
  const totalMonthly = fixedMonthly + usageMonthly;
  return {
    nodes,
    fixedMonthly,
    usageMonthly,
    totalMonthly,
    totalHourly: totalMonthly / HOURS_PER_MONTH,
  };
}
