import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import type { FieldChartLabels, FieldChartProps } from "./FieldChart";

type Captured = {
  cartesianGrid?: Record<string, unknown>;
  xAxis?: Record<string, unknown>;
  yAxis?: Record<string, unknown>;
  tooltip?: Record<string, unknown>;
  line?: Record<string, unknown>;
};

const captured: Captured = {};

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ComposedChart: (props: Record<string, unknown> & { children: ReactNode }) => <div>{props.children as ReactNode}</div>,
  CartesianGrid: (props: Record<string, unknown>) => {
    captured.cartesianGrid = props;
    return null;
  },
  XAxis: (props: Record<string, unknown>) => {
    captured.xAxis = props;
    return null;
  },
  YAxis: (props: Record<string, unknown>) => {
    captured.yAxis = props;
    return null;
  },
  Tooltip: (props: Record<string, unknown>) => {
    captured.tooltip = props;
    return null;
  },
  Line: (props: Record<string, unknown>) => {
    captured.line = props;
    return null;
  },
}));

const { FieldChart: ActualFieldChart, ChartTooltipContent } = await import("./FieldChart");
function FieldChart(props: Pick<FieldChartProps, "points" | "locale"> & { labels: Pick<FieldChartLabels, "series" | "date"> }) {
  return (
    <ActualFieldChart
      {...props}
      symbol="BTBETRETF"
      fieldKey="nav_per_unit"
      labels={{
        ...props.labels,
        typeSelector: "Chart type",
        types: { line: "Line", lineDots: "Line with dots", columns: "Columns", area: "Area" },
      }}
    />
  );
}

const points = [{ date: "2026-09-21", value: 10, display: "10" }];

beforeEach(() => {
  captured.cartesianGrid = undefined;
  captured.xAxis = undefined;
  captured.yAxis = undefined;
  captured.tooltip = undefined;
  captured.line = undefined;
});

describe("US-035 AC5: FieldChart palette", () => {
  it("FP-1 Line uses var(--chart-1) for stroke and rendered dot, and var(--panel) for activeDot stroke", () => {
    renderToStaticMarkup(<FieldChart points={points} locale="en" labels={{ series: "NAV", date: "Date" }} />);
    expect(captured.line?.stroke).toBe("var(--chart-1)");
    const dot = captured.line?.dot as (position: { cx: number; cy: number; index: number }) => ReactNode;
    const dotHtml = renderToStaticMarkup(dot({ cx: 10, cy: 20, index: 0 }));
    const activeDot = captured.line?.activeDot as { fill: string; stroke: string };
    expect(dotHtml).toContain('fill="var(--chart-1)"');
    expect(activeDot.fill).toBe("var(--chart-1)");
    expect(activeDot.stroke).toBe("var(--panel)");
  });

  it("FP-2 grid and axes use var(--line) for stroke and var(--muted) for tick fill", () => {
    renderToStaticMarkup(<FieldChart points={points} locale="en" labels={{ series: "NAV", date: "Date" }} />);
    expect(captured.cartesianGrid?.stroke).toBe("var(--line)");
    expect(captured.xAxis?.stroke).toBe("var(--line)");
    expect((captured.xAxis?.tick as { fill: string }).fill).toBe("var(--muted)");
    expect(captured.yAxis?.stroke).toBe("var(--line)");
    expect((captured.yAxis?.tick as { fill: string }).fill).toBe("var(--muted)");
  });

  it("FP-3 tooltip markup uses var(--panel) background, var(--line) border, var(--muted) date", () => {
    const html = renderToStaticMarkup(
      <ChartTooltipContent active={true} payload={[{ payload: { date: "2026-09-21", value: 10, display: "10" } }]} locale="en" labels={{ series: "NAV", date: "Date" }} />,
    );
    expect(html).toContain("var(--panel)");
    expect(html).toContain("var(--line)");
    expect(html).toContain("var(--muted)");
  });

  it("FP-4 no hex/rgb/hsl colour literal in the source", () => {
    const source = readFileSync(new URL("./FieldChart.tsx", import.meta.url), "utf8");
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
  });
});
