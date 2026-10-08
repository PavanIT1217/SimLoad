/** Stroke width grows with log10(rps): 1 req/s ~1px, 100M req/s ~9px. */
export function strokeWidthFor(rps: number): number {
  return 1 + Math.log10(Math.max(1, rps));
}
