import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import ro from "../messages/ro.json";
import { HomeTable, type HomeTableProps } from "./HomeTable";
import type { Locale } from "@/i18n/locale";
import type { HomeTableViewModel } from "@/lib/monitoring/home";

function render(locale: Locale, messages: typeof ro | typeof en, props: HomeTableProps) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <HomeTable {...props} />
    </NextIntlClientProvider>,
  );
}

const viewModel: HomeTableViewModel = {
  columns: [{ fieldKey: "nav_per_unit", labelRo: "VUAN", labelEn: "NAV per unit" }],
  rows: [
    {
      symbol: "NOADAPTER",
      name: "No Adapter ETF",
      adapterAvailable: false,
      latestPdfUrl: null,
      valueDate: null,
      cells: { nav_per_unit: { tracked: false } },
    },
  ],
};

describe("US-035 AC6: HH-1 extraction-unavailable hook", () => {
  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("HH-1 the marker span carries data-extraction-unavailable and the translated note (%s)", (locale, messages) => {
    const html = render(locale, messages, { status: "ok", viewModel });
    expect(html).toContain('data-extraction-unavailable="true"');
    expect(html).toContain(` (${messages.Home.extractionUnavailable})`);
  });
});
