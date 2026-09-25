import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import ro from "../messages/ro.json";
import { EtfDetail, type EtfDetailProps } from "./EtfDetail";
import type { Locale } from "@/i18n/locale";
import type { EtfHistory } from "@/lib/monitoring/history";

// US-019: keeps EtfDetail's own tests independent of Recharts, which is asserted directly in
// FieldChart.test.tsx / .smoke.test.tsx.
let chartCalls: Record<string, unknown>[] = [];
vi.mock("./FieldChart", () => ({
  FieldChart: (props: Record<string, unknown>) => {
    chartCalls.push(props);
    return <div data-mock-chart={(props.labels as { series: string }).series} />;
  },
}));

afterEach(() => {
  chartCalls = [];
});

function render(locale: Locale, messages: typeof ro | typeof en, props: EtfDetailProps) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <EtfDetail {...props} />
    </NextIntlClientProvider>,
  );
}

const baseHistory: EtfHistory = {
  etf: { symbol: "BTBETRETF", name: "Fondul Deschis de Investiții BT Index România ETF BET-TR", isActive: true },
  fields: [{ fieldKey: "nav_per_unit", labelRo: "VUAN", labelEn: "NAV per unit" }],
  rows: [{ reportDate: "2026-09-22", values: { nav_per_unit: "11.171" } }],
};

describe("EtfDetail", () => {
  it("shows the translated error message on status:error, never a raw exception string", () => {
    const html = render("en", en, { status: "error" });
    expect(html).toContain(en.EtfDetail.loadError);
    expect(html).not.toContain("<table>");
    expect(html).not.toContain("<h1>");
  });

  it("renders the heading with symbol and stored name, and the history table, when there is history", () => {
    const html = render("en", en, { status: "ok", history: baseHistory });
    expect(html).toContain("<h1>BTBETRETF");
    expect(html).toContain(baseHistory.etf.name);
    expect(html).toContain("<table>");
  });

  it("the stored name is shown byte-identical in both locales (never translated)", () => {
    const roHtml = render("ro", ro, { status: "ok", history: baseHistory });
    const enHtml = render("en", en, { status: "ok", history: baseHistory });
    expect(roHtml).toContain(baseHistory.etf.name);
    expect(enHtml).toContain(baseHistory.etf.name);
  });

  it("no ok report -> translated noHistory message, heading still shown, no table", () => {
    const noRows: EtfHistory = { ...baseHistory, rows: [] };
    const html = render("en", en, { status: "ok", history: noRows });
    expect(html).toContain("<h1>BTBETRETF");
    expect(html).toContain(en.EtfDetail.noHistory);
    expect(html).not.toContain("<table>");
  });

  it("no tracked fields -> translated noTrackedFields message, no table", () => {
    const noFields: EtfHistory = { ...baseHistory, fields: [] };
    const html = render("en", en, { status: "ok", history: noFields });
    expect(html).toContain(en.EtfDetail.noTrackedFields);
    expect(html).not.toContain("<table>");
  });

  it("neither fields nor rows -> noTrackedFields alone, noHistory is absent (precedence, plan §4.4)", () => {
    const empty: EtfHistory = { ...baseHistory, fields: [], rows: [] };
    const html = render("en", en, { status: "ok", history: empty });
    expect(html).toContain(en.EtfDetail.noTrackedFields);
    expect(html).not.toContain(en.EtfDetail.noHistory);
  });

  it("an inactive ETF's history still renders its table", () => {
    const inactive: EtfHistory = { ...baseHistory, etf: { ...baseHistory.etf, isActive: false } };
    const html = render("en", en, { status: "ok", history: inactive });
    expect(html).toContain("<table>");
  });

  it("ro and en renders never contain the other locale's differing state text", () => {
    const noRows: EtfHistory = { ...baseHistory, rows: [] };
    const roHtml = render("ro", ro, { status: "ok", history: noRows });
    const enHtml = render("en", en, { status: "ok", history: noRows });
    expect(roHtml).not.toContain(en.EtfDetail.noHistory);
    expect(enHtml).not.toContain(ro.EtfDetail.noHistory);
  });

  describe("US-019 charts", () => {
    const threeFieldHistory: EtfHistory = {
      etf: baseHistory.etf,
      fields: [
        { fieldKey: "b_field", labelRo: "B ro", labelEn: "B en" },
        { fieldKey: "a_field", labelRo: "A ro", labelEn: "A en" },
        { fieldKey: "c_field", labelRo: "C ro", labelEn: "C en" },
      ],
      rows: [{ reportDate: "2026-09-22", values: { b_field: "1", a_field: "2", c_field: "3", net_asset: "999" } }],
    };

    it("AC1: exactly one chart section per tracked field, in the given (display_order) order, and none for an untracked but stored field", () => {
      const html = render("en", en, { status: "ok", history: threeFieldHistory });
      expect(html).toContain(en.EtfDetail.chartsHeading);
      const order = ["b_field", "a_field", "c_field"].map((key) => html.indexOf(`data-chart-field="${key}"`));
      expect(order.every((i) => i !== -1)).toBe(true);
      expect(order[0]).toBeLessThan(order[1]);
      expect(order[1]).toBeLessThan(order[2]);
      expect(html).not.toContain('data-chart-field="net_asset"');
      expect(chartCalls).toHaveLength(3);
    });

    it("AC1: labels shown are the locale's catalogue label", () => {
      const roHtml = render("ro", ro, { status: "ok", history: threeFieldHistory });
      expect(roHtml).toContain("<h3>B ro</h3>");
      expect(roHtml).toContain("<h3>A ro</h3>");
      expect(roHtml).toContain("<h3>C ro</h3>");
      expect(roHtml).not.toContain("B en");
    });

    it("AC4: no ok report -> no chart heading, no chart sections, chart mock never called", () => {
      const noRows: EtfHistory = { ...baseHistory, rows: [] };
      const html = render("en", en, { status: "ok", history: noRows });
      expect(html).not.toContain(en.EtfDetail.chartsHeading);
      expect(html).not.toContain("data-chart-field");
      expect(chartCalls).toHaveLength(0);
    });

    it("AC4: no tracked fields -> no chart section at all", () => {
      const noFields: EtfHistory = { ...baseHistory, fields: [] };
      const html = render("en", en, { status: "ok", history: noFields });
      expect(html).not.toContain(en.EtfDetail.chartsHeading);
      expect(chartCalls).toHaveLength(0);
    });

    it("AC4: status error -> no chart section", () => {
      const html = render("en", en, { status: "error" });
      expect(html).not.toContain(en.EtfDetail.chartsHeading);
      expect(chartCalls).toHaveLength(0);
    });

    it("AC4: a field with no value on any date shows the translated no-data message instead of a chart, the other field still gets one", () => {
      const mixed: EtfHistory = {
        etf: baseHistory.etf,
        fields: [
          { fieldKey: "has_value", labelRo: "Are valoare", labelEn: "Has value" },
          { fieldKey: "no_value", labelRo: "Fără valoare", labelEn: "No value" },
        ],
        rows: [
          { reportDate: "2026-09-21", values: { has_value: "1", no_value: null } },
          { reportDate: "2026-09-22", values: { has_value: "2", no_value: null } },
        ],
      };
      const enHtml = render("en", en, { status: "ok", history: mixed });
      expect(enHtml).toContain(en.EtfDetail.noFieldData);
      expect(chartCalls).toHaveLength(1);
      const roHtml = render("ro", ro, { status: "ok", history: mixed });
      expect(roHtml).toContain(ro.EtfDetail.noFieldData);
      expect(roHtml).not.toContain(en.EtfDetail.noFieldData);
    });

    it("AC7: the chart mock receives only plain, JSON-round-trippable props with exactly the expected keys", () => {
      render("en", en, { status: "ok", history: threeFieldHistory });
      expect(chartCalls).toHaveLength(3);
      for (const props of chartCalls) {
        expect(Object.keys(props).sort()).toEqual(["labels", "locale", "points"]);
        expect(JSON.parse(JSON.stringify(props))).toEqual(props);
      }
    });
  });
});
