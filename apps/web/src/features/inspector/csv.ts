/** Column names that hold latency, most specific first ("timeStamp" must not win over "elapsed"). */
const PREFERRED_COLUMNS = [
  /latency/i,
  /elapsed/i,
  /duration/i,
  /response.?time/i,
  /_ms$|^ms$/i,
  /time/i,
];

function splitRow(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ''));
}

function detectDelimiter(line: string): string {
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestCount = 0;
  for (const d of candidates) {
    const count = line.split(d).length - 1;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

const isNumeric = (cell: string) => cell !== '' && Number.isFinite(Number(cell));

/**
 * Extracts latency samples (ms) from CSV text. Accepts a single column of
 * numbers, or a table with a header, preferring a column whose name looks
 * like a latency ("latency_ms", "duration", ...). Non-numeric cells are skipped.
 */
export function parseLatencyCsv(text: string): number[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const first = lines[0];
  if (first === undefined) return [];
  const delimiter = detectDelimiter(first);
  const header = splitRow(first, delimiter);
  const hasHeader = header.some((cell) => !isNumeric(cell));
  const rows = (hasHeader ? lines.slice(1) : lines).map((l) => splitRow(l, delimiter));

  let column = -1;
  for (const pattern of hasHeader ? PREFERRED_COLUMNS : []) {
    column = header.findIndex((h) => pattern.test(h));
    if (column >= 0) break;
  }
  if (column < 0) {
    const width = Math.max(header.length, ...rows.map((r) => r.length));
    for (let c = 0; c < width && column < 0; c++) {
      if (rows.some((r) => isNumeric(r[c] ?? ''))) column = c;
    }
  }
  if (column < 0) return [];
  return rows.map((r) => Number(r[column] ?? '')).filter((x) => Number.isFinite(x) && x > 0);
}
