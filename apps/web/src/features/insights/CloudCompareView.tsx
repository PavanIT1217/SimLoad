import {
  CLOUD_PRICES_AS_OF,
  CLOUD_PRICE_LISTS,
  PRICING_ASSUMPTIONS,
  cloudPricePatches,
  compareCloudCosts,
  type CloudProviderId,
} from '@simload/engine';
import { useMemo } from 'react';
import { useDesignStore } from '../../state/designStore';
import { useSimStore } from '../../state/simStore';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../../ui/Button';
import { formatUsd } from '../../ui/format';
import { Section } from '../../ui/Section';

/**
 * The same design priced on AWS, Azure and Google Cloud list prices, with the
 * live instance counts and traffic. One click copies a provider's prices into
 * the design so budgets and the planner use them.
 */
export function CloudCompareView() {
  const design = useDesignStore((s) => s.design);
  const latest = useSimStore((s) => s.latest);
  const costs = useMemo(() => compareCloudCosts(design, latest), [design, latest]);
  const cheapest = Math.min(...costs.map((c) => c.totalMonthly));
  const rows = design.nodes.filter((n) => n.kind !== 'client');

  const apply = (provider: CloudProviderId, name: string) => {
    useDesignStore.getState().applyConfigs(cloudPricePatches(design, provider));
    useUiStore.getState().showToast(`Component prices set to ${name} list prices`);
  };

  return (
    <Section title="Cloud cost comparison">
      <div className="cloud-totals">
        {costs.map((c) => (
          <div
            key={c.provider}
            className={`cloud-total ${c.totalMonthly === cheapest ? 'is-cheapest' : ''}`}
          >
            <span className="cloud-name mono">{c.name}</span>
            <span className="cloud-sum">{formatUsd(c.totalMonthly)}</span>
            <span className="cloud-unit mono">/ month</span>
            {c.totalMonthly === cheapest && <span className="cloud-flag mono">Lowest</span>}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => apply(c.provider, c.name)}
              title={`Copy ${c.name} prices into every component (one undo step)`}
            >
              Use prices
            </Button>
          </div>
        ))}
      </div>
      <div className="cloud-scroll">
        <table className="cost-table cloud-table mono">
          <thead>
            <tr>
              <th scope="col">Component</th>
              {costs.map((c) => (
                <th key={c.provider} scope="col">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((node) => (
              <tr key={node.id}>
                <th scope="row">{node.label}</th>
                {costs.map((c) => {
                  const cell = c.nodes.find((n) => n.nodeId === node.id);
                  return (
                    <td key={c.provider} title={`${c.name}: ${cell?.sku ?? 'own per-call price'}`}>
                      {formatUsd(cell?.monthly ?? 0)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Hover a price to see the product it maps to.</p>
      <details className="cloud-notes small muted">
        <summary>How this is priced (list prices, {CLOUD_PRICES_AS_OF})</summary>
        <p>
          On-demand list prices with no reservations or discounts. Each simulated instance maps to
          one managed unit (2 vCPU VM, ~6 GB Redis node, 2 vCPU PostgreSQL server). Load balancer,
          queue and CDN charges scale with the live traffic, assuming {PRICING_ASSUMPTIONS.apiKb} KB
          per API call, {PRICING_ASSUMPTIONS.cdnObjectKb} KB per CDN object and{' '}
          {PRICING_ASSUMPTIONS.messageKb} KB per queue message. Storage, backups, multi-zone
          replicas and support plans are not included. Prices change: check the official pages
          before you budget.
        </p>
        <ul>
          {CLOUD_PRICE_LISTS.map((l) => (
            <li key={l.id}>
              {l.name} · {l.region} ·{' '}
              <a href={l.sources[0]} target="_blank" rel="noreferrer">
                pricing
              </a>
            </li>
          ))}
        </ul>
      </details>
    </Section>
  );
}
