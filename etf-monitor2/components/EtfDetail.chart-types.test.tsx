import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import ro from "../messages/ro.json";
import { EtfDetail } from "./EtfDetail";
import type { EtfHistory } from "@/lib/monitoring/history";

const history: EtfHistory = {
  etf: { symbol: "BTBETRETF", name: "ETF", isActive: true, adapterAvailable: true },
  fields: [
    { fieldKey: "nav_per_unit", labelRo: "VUAN", labelEn: "NAV per unit" },
    { fieldKey: "net_asset", labelRo: "Activ net", labelEn: "Net asset" },
  ],
  rows: [{ reportDate: "2026-09-22", values: { nav_per_unit: "11.171", net_asset: "100" } }],
};

describe("US-038 detail chart controls with real FieldChart", () => {
  it.each([
    ["ro", ro, en] as const,
    ["en", en, ro] as const,
  ])("renders a default line selector independently for each chart in %s", (locale, messages, other) => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
        <EtfDetail status="ok" history={history} />
      </NextIntlClientProvider>,
    );
    expect(html.match(/data-chart-type="selector"/g)).toHaveLength(2);
    expect(html.match(/<option value="line" selected="">/g)).toHaveLength(2);
    const sections = html.split('data-chart-field="').slice(1);
    expect(sections).toHaveLength(2);
    for (const [index, key] of ["nav_per_unit", "net_asset"].entries()) {
      expect(sections[index]).toMatch(new RegExp(`^${key}"`));
      expect(sections[index]).toContain(messages.EtfDetail.chartType);
      expect(sections[index]).not.toContain(other.EtfDetail.chartType);
      for (const [type, label] of Object.entries(messages.EtfDetail.chartTypes)) {
        expect(sections[index]).toContain(`<option value="${type}"${type === "line" ? ' selected=""' : ""}>${label}</option>`);
      }
    }
  });
});
