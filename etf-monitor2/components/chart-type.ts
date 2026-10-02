import type { ChartPoint } from "@/lib/monitoring/chart-series";

export const CHART_TYPES = ["line", "lineDots", "columns", "area"] as const;
export type ChartType = (typeof CHART_TYPES)[number];
export const DEFAULT_CHART_TYPE: ChartType = "line";

type ChartStorage = Pick<Storage, "getItem" | "setItem">;

export function chartStorageKey(symbol: string, fieldKey: string): string {
  return `etf-chart:${JSON.stringify([symbol, fieldKey])}`;
}

export function parseChartType(value: unknown): ChartType {
  return typeof value === "string" && (CHART_TYPES as readonly string[]).includes(value)
    ? value as ChartType
    : DEFAULT_CHART_TYPE;
}

export function readChartType(getStorage: () => ChartStorage, symbol: string, fieldKey: string): ChartType {
  try {
    return parseChartType(getStorage().getItem(chartStorageKey(symbol, fieldKey)));
  } catch {
    return DEFAULT_CHART_TYPE;
  }
}

export function writeChartType(getStorage: () => ChartStorage, symbol: string, fieldKey: string, type: ChartType): void {
  try {
    getStorage().setItem(chartStorageKey(symbol, fieldKey), type);
  } catch {
    // Browser storage may be disabled; the in-memory selection still works.
  }
}

export function isSingleValue(points: readonly ChartPoint[]): boolean {
  return points.filter((point) => point.value !== null).length === 1;
}

export function isIsolatedValue(points: readonly ChartPoint[], index: number): boolean {
  return points[index]?.value !== null
    && points[index]?.value !== undefined
    && (index === 0 || points[index - 1].value === null)
    && (index === points.length - 1 || points[index + 1].value === null);
}
