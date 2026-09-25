import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import ro from "../messages/ro.json";
import { EtfDetail, type EtfDetailProps } from "./EtfDetail";
import type { Locale } from "@/i18n/locale";
import type { EtfHistory } from "@/lib/monitoring/history";

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
});
