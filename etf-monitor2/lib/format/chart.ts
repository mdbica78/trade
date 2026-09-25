import type { Locale } from "@/i18n/locale";
import type { ChartPoint } from "@/lib/monitoring/chart-series";
import { formatNumber } from "./number";
import { formatReportDate } from "./date";

/**
 * Y-axis tick label (US-019 AC3). Ticks are axis graduations, not stored values, so rounding is
 * fine here — exactness is required only of the tooltip, which formats `display` instead. The
 * fixed `en-US` base (no grouping) gives a plain ASCII digits/`.`/`-` string; `formatNumber`
 * (DEC-007) then applies the locale's decimal mark, so ticks and the history table share one rule
 * without depending on ICU `ro-RO` data.
 */
export function formatAxisTick(n: number, locale: Locale): string {
  if (!Number.isFinite(n)) {
    return "";
  }
  const ascii = new Intl.NumberFormat("en-US", { useGrouping: false, maximumFractionDigits: 6 }).format(n);
  return formatNumber(ascii, locale);
}

/**
 * Tooltip content for one chart point (US-019 AC3). Formats `point.display` — the stored string
 * — never `point.value` (the plotting float). `null` for a gap point (no tooltip on a missing
 * day, FR4.1 "blank").
 */
export function formatTooltip(point: ChartPoint, locale: Locale): { date: string; value: string } | null {
  if (point.display === null) {
    return null;
  }
  return { date: formatReportDate(point.date, locale), value: formatNumber(point.display, locale) };
}
