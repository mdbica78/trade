import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import type { FieldChartLabels, FieldChartProps } from "./FieldChart";

type Captured = {
  composedChart?: Record<string, unknown>;
  cartesianGrid?: Record<string, unknown>;
  xAxis?: Record<string, unknown>;
  yAxis?: Record<string, unknown>;
  tooltip?: Record<string, unknown>;
  line?: Record<string, unknown>;
  bar?: Record<string, unknown>;
  area?: Record<string, unknown>;
  labelList?: Record<string, unknown>;
};

const captured: Captured = {};

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ComposedChart: (props: Record<string, unknown> & { children: ReactNode }) => {
    captured.composedChart = props;
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
  Bar: (props: Record<string, unknown> & { children?: ReactNode }) => {
    captured.bar = props;
    return <div>{props.children}</div>;
  },
  Area: (props: Record<string, unknown>) => {
    captured.area = props;
    return null;
  },
  LabelList: (props: Record<string, unknown>) => {
    captured.labelList = props;
    return null;
  },
}));

// Imported after the mock so the mocked module is used.
const { FieldChart: ActualFieldChart, ChartTooltipContent, ChartSeries } = await import("./FieldChart");
const selectorLabels: Pick<FieldChartLabels, "typeSelector" | "types"> = {
  typeSelector: "Chart type",
  types: { line: "Line", lineDots: "Line with dots", columns: "Columns", area: "Area" },
};
function FieldChart(props: Pick<FieldChartProps, "points" | "locale"> & { labels: Pick<FieldChartLabels, "series" | "date"> }) {
  return <ActualFieldChart {...props} symbol="BTBETRETF" fieldKey="nav_per_unit" labels={{ ...props.labels, ...selectorLabels }} />;
}

const points = [
  { date: "2026-09-21", value: 10, display: "10" },
  { date: "2026-09-22", value: null, display: null },
  { date: "2026-09-23", value: 12, display: "12" },
];

beforeEach(() => {
  captured.composedChart = undefined;
  captured.cartesianGrid = undefined;
  captured.xAxis = undefined;
  captured.yAxis = undefined;
  captured.tooltip = undefined;
  captured.line = undefined;
  captured.bar = undefined;
  captured.area = undefined;
  captured.labelList = undefined;
});

describe("FieldChart (mocked recharts)", () => {
  it("renders without throwing and passes data to the composed chart", () => {
    renderToStaticMarkup(<FieldChart points={points} locale="en" labels={{ series: "NAV per unit", date: "Date" }} />);
    expect(captured.composedChart?.data).toEqual(points);
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

describe("US-038 chart variants", () => {
  const singlePoint = [{ date: "2026-09-21", value: 11.171, display: "11.171" }];
  const isolated = [
    { date: "2026-09-20", value: 10, display: "10" },
    { date: "2026-09-21", value: null, display: null },
    { date: "2026-09-22", value: 11.171, display: "11.171" },
    { date: "2026-09-23", value: null, display: null },
    { date: "2026-09-24", value: 12, display: "12" },
    { date: "2026-09-25", value: 13, display: "13" },
  ];

  it("starts with the line selector, four ordered translated options and chart identity", () => {
    const html = renderToStaticMarkup(<FieldChart points={points} locale="en" labels={{ series: "NAV", date: "Date" }} />);
    expect(html).toContain("Chart type");
    expect(html).toContain('<select data-chart-type="selector"');
    expect(html).toContain('<option value="line" selected="">Line</option>');
    for (const [id, label] of Object.entries(selectorLabels.types)) {
      expect(html).toContain(`<option value="${id}"${id === "line" ? ' selected=""' : ""}>${label}</option>`);
    }
    expect(captured.composedChart?.data).toEqual(points);
    expect(captured.line).toBeDefined();
    expect(captured.area).toBeUndefined();
    expect(captured.bar).toBeUndefined();
  });

  it("renders all selector strings in RO and EN without the other locale's strings", () => {
    const roTypes = { line: "Linie", lineDots: "Linie cu puncte", columns: "Coloane", area: "Arie" };
    const roHtml = renderToStaticMarkup(
      <ActualFieldChart
        points={points}
        locale="ro"
        symbol="BTBETRETF"
        fieldKey="nav_per_unit"
        labels={{ series: "VUAN", date: "Dată", typeSelector: "Tipul graficului", types: roTypes }}
      />,
    );
    const enHtml = renderToStaticMarkup(<FieldChart points={points} locale="en" labels={{ series: "NAV", date: "Date" }} />);
    expect(roHtml).toContain("Tipul graficului");
    expect(roHtml).not.toContain("Chart type");
    expect(enHtml).toContain("Chart type");
    expect(enHtml).not.toContain("Tipul graficului");
    for (const type of ["line", "lineDots", "columns", "area"] as const) {
      expect(roHtml).toContain(`>${roTypes[type]}</option>`);
      expect(roHtml).not.toContain(`>${selectorLabels.types[type]}</option>`);
      expect(enHtml).toContain(`>${selectorLabels.types[type]}</option>`);
      expect(enHtml).not.toContain(`>${roTypes[type]}</option>`);
    }
  });

  it.each(["line", "lineDots", "columns", "area"] as const)("%s uses the right series and tokens without filling gaps", (type) => {
    renderToStaticMarkup(ChartSeries({ points: isolated, locale: "en", series: "NAV", type }));
    if (type === "columns") {
      expect(captured.bar?.dataKey).toBe("value");
      expect(captured.bar?.fill).toBe("var(--chart-1)");
      expect(captured.line).toBeUndefined();
      expect(captured.area).toBeUndefined();
    } else {
      const series = type === "area" ? captured.area : captured.line;
      expect(series?.dataKey).toBe("value");
      expect(series?.connectNulls).toBe(false);
      expect(series?.stroke).toBe("var(--chart-1)");
      expect(captured.bar).toBeUndefined();
      if (type === "area") {
        expect(series?.fill).toBe("var(--chart-1)");
        expect(series?.fillOpacity).toBe(0.18);
        expect(captured.line).toBeUndefined();
      } else {
        const dot = series?.dot as (position: { cx: number; cy: number; index: number }) => ReactNode;
        expect(renderToStaticMarkup(dot({ cx: 12, cy: 20, index: 1 }))).toBe("");
        expect(renderToStaticMarkup(dot({ cx: 12, cy: 20, index: 4 }))).toBe(type === "line" ? "" : '<g><circle cx="12" cy="20" r="3" fill="var(--chart-1)"></circle></g>');
        expect(renderToStaticMarkup(dot({ cx: 12, cy: 20, index: 2 }))).toContain('r="3"');
      }
    }
  });

  it.each(["line", "lineDots", "columns", "area"] as const)(
    "%s makes a single value large and labels its stored display string in RO and EN",
    (type) => {
      for (const [locale, expected] of [["ro", "11,171"], ["en", "11.171"]] as const) {
        for (const data of [singlePoint, [isolated[1], singlePoint[0], isolated[3]]]) {
          Object.assign(captured, { line: undefined, bar: undefined, area: undefined, labelList: undefined });
          renderToStaticMarkup(ChartSeries({ points: data, locale, series: "NAV", type }));
          const index = data.length === 1 ? 0 : 1;
          let html: string;
          if (type === "columns") {
            const content = captured.labelList?.content as (position: { x: number; y: number; width: number; index: number }) => ReactNode;
            expect(typeof content).toBe("function");
            html = renderToStaticMarkup(content({ x: 10, y: 20, width: 16, index }));
          } else {
            const content = (type === "area" ? captured.area?.dot : captured.line?.dot) as
              (position: { cx: number; cy: number; index: number }) => ReactNode;
            expect(typeof content).toBe("function");
            html = renderToStaticMarkup(content({ cx: 18, cy: 20, index }));
          }
          expect(html).toContain('r="6"');
          expect(html).toContain(expected);
          expect(html).toContain('fill="var(--chart-1)"');
          expect(html).not.toContain("undefined");
        }
      }
    },
  );

  it("does not import a server write path or introduce colour literals", () => {
    for (const name of ["FieldChart.tsx", "chart-type.ts"]) {
      const source = readFileSync(new URL(name, import.meta.url), "utf8");
      expect(source).not.toMatch(/\bfetch\s*\(|lib\/db|lib\/config|server action/i);
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/);
    }
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

describe("Tooltip wiring (US-031 AC5, Sprint 4 audit W3)", () => {
  it("FC-TT1 (ro): the content actually passed to Tooltip renders the formatted date and value", () => {
    renderToStaticMarkup(<FieldChart points={points} locale="ro" labels={{ series: "VUAN", date: "Dată" }} />);
    const content = captured.tooltip?.content as (p: unknown) => ReactNode;
    expect(typeof content).toBe("function");

    const html = renderToStaticMarkup(
      content({
        active: true,
        payload: [{ payload: { date: "2026-09-21", value: 54.1373, display: "54.1373" } }],
      }),
    );
    expect(html).toContain("Dată: 21.09.2026");
    expect(html).toContain("VUAN: 54,1373");
  });

  it("FC-TT2 (en): the same call gives the English date and dot decimal mark", () => {
    renderToStaticMarkup(<FieldChart points={points} locale="en" labels={{ series: "NAV per unit", date: "Date" }} />);
    const content = captured.tooltip?.content as (p: unknown) => ReactNode;

    const html = renderToStaticMarkup(
      content({
        active: true,
        payload: [{ payload: { date: "2026-09-21", value: 54.1373, display: "54.1373" } }],
      }),
    );
    expect(html).toContain("Date: 2026-09-21");
    expect(html).toContain("NAV per unit: 54.1373");
  });

  it("FC-TT3: the value shown comes from the stored display string, not the float", () => {
    renderToStaticMarkup(<FieldChart points={points} locale="ro" labels={{ series: "VUAN", date: "Dată" }} />);
    const content = captured.tooltip?.content as (p: unknown) => ReactNode;

    const html = renderToStaticMarkup(
      content({
        active: true,
        payload: [{ payload: { date: "2026-09-21", value: 54.137299999, display: "54.1373" } }],
      }),
    );
    expect(html).toContain("VUAN: 54,1373");
  });

  it("FC-TT4: an inactive or empty payload renders nothing", () => {
    renderToStaticMarkup(<FieldChart points={points} locale="en" labels={{ series: "NAV per unit", date: "Date" }} />);
    const content = captured.tooltip?.content as (p: unknown) => ReactNode;

    expect(
      renderToStaticMarkup(
        content({ active: false, payload: [{ payload: { date: "2026-09-21", value: 1, display: "1" } }] }),
      ),
    ).toBe("");
    expect(renderToStaticMarkup(content({ active: true, payload: [] }))).toBe("");
    expect(renderToStaticMarkup(content({ active: true }))).toBe("");
  });
});
