import { describe, expect, it } from "vitest";
import {
  CHART_TYPES, DEFAULT_CHART_TYPE, chartStorageKey, isIsolatedValue, isSingleValue,
  parseChartType, readChartType, writeChartType,
} from "./chart-type";
import type { ChartPoint } from "@/lib/monitoring/chart-series";

const value = (date: string): ChartPoint => ({ date, value: 11.171, display: "11.171" });
const gap = (date: string): ChartPoint => ({ date, value: null, display: null });

describe("per-chart type", () => {
  it("defaults to line and rejects unknown or absent stored types", () => {
    expect(CHART_TYPES).toEqual(["line", "lineDots", "columns", "area"]);
    expect(DEFAULT_CHART_TYPE).toBe("line");
    expect(parseChartType(null)).toBe("line");
    expect(parseChartType("unknown")).toBe("line");
    expect(CHART_TYPES.map(parseChartType)).toEqual(CHART_TYPES);
  });

  it("stores independently per ETF symbol and field, even when ids contain separators", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, type: string) => { values.set(key, type); },
    };
    writeChartType(() => storage, "BT/BET", "nav:unit", "columns");
    expect(readChartType(() => storage, "BT/BET", "nav:unit")).toBe("columns");
    expect(readChartType(() => storage, "TVBETETF", "nav:unit")).toBe("line");
    expect(readChartType(() => storage, "BT/BET", "net_asset")).toBe("line");
    expect(chartStorageKey("BT/BET", "nav:unit")).not.toBe(chartStorageKey("BT", "BET/nav:unit"));
    expect(chartStorageKey("BT:BET", "nav")).not.toBe(chartStorageKey("BT", "BET:nav"));
  });

  it("uses line when storage throws and does not throw on write", () => {
    const throwing = () => ({
      getItem: (): string | null => { throw new Error("storage blocked"); },
      setItem: (): void => { throw new Error("storage blocked"); },
    });
    expect(readChartType(throwing, "BTBETRETF", "nav")).toBe("line");
    expect(() => writeChartType(throwing, "BTBETRETF", "nav", "area")).not.toThrow();
    expect(readChartType(() => { throw new Error("storage unavailable"); }, "BTBETRETF", "nav")).toBe("line");
  });
});

describe("point visibility", () => {
  it("counts real values instead of calendar positions", () => {
    expect(isSingleValue([value("2026-09-21")])).toBe(true);
    expect(isSingleValue([gap("2026-09-20"), value("2026-09-21"), gap("2026-09-22")])).toBe(true);
    expect(isSingleValue([gap("2026-09-20"), gap("2026-09-21")])).toBe(false);
    expect(isSingleValue([value("2026-09-20"), value("2026-09-21")])).toBe(false);
  });

  it("shows isolated points at either edge and between gaps, not adjacent values or gaps", () => {
    const points = [
      value("2026-09-20"), gap("2026-09-21"), value("2026-09-22"),
      gap("2026-09-23"), value("2026-09-24"), value("2026-09-25"),
      gap("2026-09-26"), value("2026-09-27"),
    ];
    expect(points.map((_, index) => isIsolatedValue(points, index))).toEqual([
      true, false, true, false, false, false, false, true,
    ]);
    expect(isIsolatedValue(points, -1)).toBe(false);
    expect(isIsolatedValue(points, points.length)).toBe(false);
  });
});
