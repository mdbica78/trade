import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import ro from "../../../messages/ro.json";
import type { Locale } from "@/i18n/locale";
import type { EtfHistory } from "@/lib/monitoring/history";

let mockLoad: (symbol: string) => Promise<EtfHistory | null>;
let notFoundCalls = 0;
let chartCalls: { labels: { series: string } }[] = [];

const NOT_FOUND_SENTINEL = new Error("NEXT_NOT_FOUND_SENTINEL");

vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/monitoring/history", () => ({
  createEtfHistoryLoader: () => mockLoad,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    notFoundCalls += 1;
    throw NOT_FOUND_SENTINEL;
  },
}));
// US-019: keeps this test independent of Recharts (which does not render meaningfully in Node
// under renderToStaticMarkup and is asserted directly in FieldChart.test.tsx / .smoke.test.tsx).
vi.mock("@/components/FieldChart", () => ({
  FieldChart: (props: { labels: { series: string } }) => {
    chartCalls.push(props);
    return <div data-mock-chart={props.labels.series} />;
  },
}));

afterEach(() => {
  notFoundCalls = 0;
  chartCalls = [];
});

async function renderDetailPage(locale: Locale, messages: typeof ro | typeof en, symbol = "BTBETRETF") {
  const { default: EtfDetailPage } = await import("./page");
  const element = await EtfDetailPage({ params: Promise.resolve({ symbol }) });
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {element}
    </NextIntlClientProvider>,
  );
}

const history: EtfHistory = {
  etf: { symbol: "BTBETRETF", name: "BT Index Romania ETF BET-TR", isActive: true },
  fields: [{ fieldKey: "nav_per_unit", labelRo: "VUAN", labelEn: "NAV per unit" }],
  rows: [{ reportDate: "2026-09-22", values: { nav_per_unit: "11.171" } }],
};

describe("EtfDetailPage", () => {
  it("AC1: renders a heading with the symbol and stored name when the loader finds the ETF", async () => {
    mockLoad = async () => history;
    const html = await renderDetailPage("en", en);
    expect(html).toContain("<h1>BTBETRETF");
    expect(html).toContain("BT Index Romania ETF BET-TR");
  });

  it("AC1: passes the exact symbol from params to the loader", async () => {
    const seen: string[] = [];
    mockLoad = async (symbol) => {
      seen.push(symbol);
      return history;
    };
    await renderDetailPage("en", en, "BTBETRETF");
    expect(seen).toEqual(["BTBETRETF"]);
  });

  it("AC1: an unknown symbol calls notFound() exactly once, outside the error handler", async () => {
    mockLoad = async () => null;
    await expect(renderDetailPage("en", en, "NOPE")).rejects.toThrow(NOT_FOUND_SENTINEL);
    expect(notFoundCalls).toBe(1);
  });

  it("AC6: a loader error shows a translated message, never the exception text, and does not call notFound()", async () => {
    mockLoad = async () => {
      throw new Error("connection refused: postgres://user:secret@db.example.com/etfs");
    };
    const html = await renderDetailPage("en", en);
    expect(html).toContain(en.EtfDetail.loadError);
    expect(html).not.toContain("connection refused");
    expect(html).not.toContain("postgres://");
    expect(html).not.toContain("secret");
    expect(notFoundCalls).toBe(0);
  });

  it("AC6: an error whose message contains a DATABASE_URL-shaped marker never leaks it", async () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://marker-value-xyz@host/db";
    try {
      mockLoad = async () => {
        throw new Error(`failed: ${process.env.DATABASE_URL}`);
      };
      const html = await renderDetailPage("en", en);
      expect(html).toContain(en.EtfDetail.loadError);
      expect(html).not.toContain("marker-value-xyz");
    } finally {
      process.env.DATABASE_URL = original;
    }
  });

  it("AC6: getDb() itself throwing (e.g. MissingDatabaseUrlError) also gives the translated error, not a crash", async () => {
    mockLoad = () => {
      throw new Error("DATABASE_URL is not set");
    };
    const html = await renderDetailPage("en", en);
    expect(html).toContain(en.EtfDetail.loadError);
    expect(html).not.toContain("DATABASE_URL");
  });

  it("ro and en renders never contain the other locale's differing text", async () => {
    mockLoad = async () => null;
    const rejectsWithSentinel = async (locale: Locale, messages: typeof ro | typeof en) => {
      await expect(renderDetailPage(locale, messages, "NOPE")).rejects.toThrow(NOT_FOUND_SENTINEL);
    };
    await rejectsWithSentinel("ro", ro);
    await rejectsWithSentinel("en", en);

    mockLoad = async () => {
      throw new Error("boom");
    };
    const roHtml = await renderDetailPage("ro", ro);
    const enHtml = await renderDetailPage("en", en);
    expect(roHtml).not.toContain(en.EtfDetail.loadError);
    expect(enHtml).not.toContain(ro.EtfDetail.loadError);
  });

  it("US-019 AC1/AC5: renders one chart section per tracked field, titled with the locale's label", async () => {
    const twoFieldHistory: EtfHistory = {
      etf: { symbol: "BTBETRETF", name: "BT Index Romania ETF BET-TR", isActive: true },
      fields: [
        { fieldKey: "units", labelRo: "Unități de fond în circulație", labelEn: "Units outstanding" },
        { fieldKey: "nav_per_unit", labelRo: "VUAN", labelEn: "NAV per unit" },
      ],
      rows: [{ reportDate: "2026-09-22", values: { units: "1000", nav_per_unit: "11.171" } }],
    };
    mockLoad = async () => twoFieldHistory;

    const roHtml = await renderDetailPage("ro", ro);
    expect(roHtml).toContain(ro.EtfDetail.chartsHeading);
    expect(roHtml).toContain("Unități de fond în circulație");
    expect(roHtml).toContain("VUAN");
    expect(chartCalls).toHaveLength(2);
    expect(chartCalls[0].labels.series).toBe("Unități de fond în circulație");
    expect(chartCalls[1].labels.series).toBe("VUAN");

    chartCalls = [];
    const enHtml = await renderDetailPage("en", en);
    expect(enHtml).toContain(en.EtfDetail.chartsHeading);
    expect(enHtml).toContain("Units outstanding");
    expect(enHtml).toContain("NAV per unit");
    expect(chartCalls).toHaveLength(2);
  });
});
