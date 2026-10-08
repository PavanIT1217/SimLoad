import type { Design, TickResult } from '@simload/engine';

const W = 180;
const H = 56;
const PAD = 40;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function colour(rho: number | undefined, failed: boolean): string {
  if (failed) return '#94a3b8';
  if (rho === undefined || rho === 0) return '#64748b';
  if (rho >= 0.9) return '#dc2626';
  if (rho >= 0.7) return '#d97706';
  return '#059669';
}

/** Print-friendly SVG of the design: boxes coloured by utilisation, arrows for edges. */
export function designSvg(design: Design, tick: TickResult | null): string {
  if (design.nodes.length === 0) return '';
  const xs = design.nodes.map((n) => n.position.x);
  const ys = design.nodes.map((n) => n.position.y);
  const minX = Math.min(...xs) - PAD;
  const minY = Math.min(...ys) - PAD;
  const width = Math.max(...xs) - minX + W + PAD;
  const height = Math.max(...ys) - minY + H + PAD;
  const pos = new Map(
    design.nodes.map((n) => [n.id, { x: n.position.x - minX, y: n.position.y - minY }]),
  );
  const edges = design.edges
    .map((e) => {
      const a = pos.get(e.source);
      const b = pos.get(e.target);
      if (!a || !b) return '';
      return `<line x1="${a.x + W}" y1="${a.y + H / 2}" x2="${b.x}" y2="${b.y + H / 2}" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>`;
    })
    .join('');
  const nodes = design.nodes
    .map((n) => {
      const p = pos.get(n.id) as { x: number; y: number };
      const live = tick?.nodes[n.id];
      const rho = n.kind === 'client' ? undefined : live?.saturation;
      const stats = live
        ? `${Math.round(live.inflowRps).toLocaleString('en-US')}/s${rho !== undefined ? ` · ρ ${rho.toFixed(2)}` : ''}`
        : n.kind;
      return (
        `<g transform="translate(${p.x},${p.y})"><rect width="${W}" height="${H}" rx="4" fill="#fff" stroke="${colour(rho, !!live?.failed)}" stroke-width="2"/>` +
        `<text x="10" y="22" font-size="13" font-weight="600">${esc(n.label)}</text>` +
        `<text x="10" y="42" font-size="11" fill="#475569">${esc(stats)}</text></g>`
      );
    })
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" font-family="system-ui, sans-serif">` +
    `<defs><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" fill="#64748b"/></marker></defs>` +
    `${edges}${nodes}</svg>`
  );
}
