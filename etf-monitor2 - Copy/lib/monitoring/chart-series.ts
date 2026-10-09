import type { HistoryRow } from "./history";

/**
 * One plotting position per calendar day (US-019 AC2). `value` is only where the point sits on
 * the chart; `display` is the stored string, byte for byte, which is what the user reads
 * (tooltip). A day with no `ok` report, or no value for the field, is `value: null`,
 * `display: null` — never interpolated or carried forward (AGENTS.md "Never guess a value").
 */
export type ChartPoint = { date: string; value: number | null; display: string | null };

const DAY_MS = 86_400_000;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isoOf(t: number): string {
  const d = new Date(t);
  const year = String(d.getUTCFullYear()).padStart(4, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * `YYYY-MM-DD` → UTC-midnight milliseconds. Pure integer arithmetic through `Date.UTC`, no local
 * time zone or DST involved (AC2 e/f: the result must not depend on the process time zone). The
 * round trip through `isoOf` rejects a rollover like `2026-02-30` (which `Date.UTC` would
 * otherwise silently normalise to March).
 */
function utcDay(iso: string): number {
  const match = ISO_DATE_RE.exec(iso);
  if (!match) {
    throw new RangeError(`invalid report date: "${iso}"`);
  }
  const t = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (!Number.isFinite(t) || isoOf(t) !== iso) {
    throw new RangeError(`invalid report date: "${iso}"`);
  }
  return t;
}

/**
 * Builds one point per calendar day from the oldest to the newest `ok` report date, for one
 * tracked field (US-019 AC2). `rows` is US-018's history model, already `ok`-only. A missing day,
 * or a day whose report has no value for `fieldKey`, gets `null`/`null`.
 */
export function buildChartSeries(rows: readonly HistoryRow[], fieldKey: string): ChartPoint[] {
  if (rows.length === 0) {
    return [];
  }

  const byDate = new Map<string, string | null>();
  for (const row of rows) {
    byDate.set(row.reportDate, row.values[fieldKey] ?? null);
  }

  const days = [...byDate.keys()].map(utcDay).sort((a, b) => a - b);
  const points: ChartPoint[] = [];
  for (let t = days[0]; t <= days[days.length - 1]; t += DAY_MS) {
    const date = isoOf(t);
    const display = byDate.get(date) ?? null;
    const value = display === null ? null : Number(display);
    points.push(value !== null && Number.isFinite(value) ? { date, value, display } : { date, value: null, display: null });
  }
  return points;
}

/** `false` when every point is a gap (AC4: no chart is drawn for a field with no data at all). */
export function hasAnyValue(points: readonly ChartPoint[]): boolean {
  return points.some((p) => p.value !== null);
}
