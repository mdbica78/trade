import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FieldChart } from "./FieldChart";
import type { ChartPoint } from "@/lib/monitoring/chart-series";

describe("FieldChart smoke (US-019 §5 R3)", () => {
  it("renders with the real recharts package without throwing", () => {
    const points: ChartPoint[] = [
      { date: "2026-09-21", value: 11.1, display: "11.1" },
      { date: "2026-09-22", value: null, display: null },
      { date: "2026-09-23", value: 11.3, display: "11.3" },
    ];

    const html = renderToStaticMarkup(
      <FieldChart points={points} locale="ro" labels={{ series: "VUAN", date: "Dată" }} />,
    );

    expect(typeof html).toBe("string");
  });
});
