import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";

type Captured = {
  lineChart?: Record<string, unknown>;
  cartesianGrid?: Record<string, unknown>;
  xAxis?: Record<string, unknown>;
  yAxis?: Record<string, unknown>;
  tooltip?: Record<string, unknown>;
  line?: Record<string, unknown>;
};

const captured: Captured = {};

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LineChart: (props: Record<string, unknown> & { children: ReactNode }) => {
    captured.lineChart = props;
    return <div>{props.children}</div>;
  },
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

// Imported after the mock so the mocked module is used.
const { FieldChart, ChartTooltipContent } = await import("./FieldChart");

const points = [
  { date: "2026-09-21", value: 10, display: "10" },
  { date: "2026-09-22", value: null, display: null },
  { date: "2026-09-23", value: 12, display: "12" },
];

beforeEach(() => {
  captured.lineChart = undefined;
  captured.cartesianGrid = undefined;
  captured.xAxis = undefined;
  captured.yAxis = undefined;
  captured.tooltip = undefined;
  captured.line = undefined;
});

describe("FieldChart (mocked recharts)", () => {
  it("renders without throwing and passes data to LineChart", () => {
    renderToStaticMarkup(<FieldChart points={points} locale="en" labels={{ series: "NAV per unit", date: "Date" }} />);
    expect(captured.lineChart?.data).toEqual(points);
  });

  it("AC2: Line has connectNulls false, type linear, dataKey value, and a truthy dot", () => {
    renderToStaticMarkup(<FieldChart points={points} locale="en" labels={{ series: "NAV per unit", date: "Date" }} />);
    expect(captured.line?.connectNulls).toBe(false);
    expect(captured.line?.type).toBe("linear");
    expect(captured.line?.dataKey).toBe("value");
    expect(captured.line?.dot).toBeTruthy();
    expect(captured.line?.dot).not.toBe(false);
  });

  it("AC3: XAxis dataKey is date, and its tickFormatter wiring matches formatReportDate for the locale", () => {
    renderToStaticMarkup(<FieldChart points={points} locale="ro" labels={{ series: "VUAN", date: "Dată" }} />);
    expect(captured.xAxis?.dataKey).toBe("date");
    const tickFormatter = captured.xAxis?.tickFormatter as (d: string) => string;
    expect(tickFormatter("2026-09-22")).toBe("22.09.2026");
  });

  it("AC3: XAxis tickFormatter for en gives the ISO date unchanged", () => {
    renderToStaticMarkup(<FieldChart points={points} locale="en" labels={{ series: "NAV per unit", date: "Date" }} />);
    const tickFormatter = captured.xAxis?.tickFormatter as (d: string) => string;
    expect(tickFormatter("2026-09-22")).toBe("2026-09-22");
  });

  it("AC3: YAxis tickFormatter applies the locale's decimal mark with no grouping", () => {
    renderToStaticMarkup(<FieldChart points={points} locale="ro" labels={{ series: "VUAN", date: "Dată" }} />);
    const tickFormatter = captured.yAxis?.tickFormatter as (n: number) => string;
    expect(tickFormatter(1234567.5)).toBe("1234567,5");
  });
});

describe("ChartTooltipContent", () => {
  it("renders the formatted date and display value when active", () => {
    const html = renderToStaticMarkup(
      <ChartTooltipContent active={true} payload={[{ payload: { date: "2026-09-22", value: 11.171, display: "11.171" } }]} locale="en" labels={{ series: "NAV per unit", date: "Date" }} />,
    );
    expect(html).toContain("Date: 2026-09-22");
    expect(html).toContain("NAV per unit: 11.171");
  });

  it("renders nothing when not active", () => {
    const html = renderToStaticMarkup(
      <ChartTooltipContent active={false} payload={[{ payload: { date: "2026-09-22", value: 11.171, display: "11.171" } }]} locale="en" labels={{ series: "NAV per unit", date: "Date" }} />,
    );
    expect(html).toBe("");
  });

  it("renders nothing for a gap point", () => {
    const html = renderToStaticMarkup(
      <ChartTooltipContent active={true} payload={[{ payload: { date: "2026-09-22", value: null, display: null } }]} locale="en" labels={{ series: "NAV per unit", date: "Date" }} />,
    );
    expect(html).toBe("");
  });
});
