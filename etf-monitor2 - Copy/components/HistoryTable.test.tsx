import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import ro from "../messages/ro.json";
import { HistoryTable, type HistoryTableProps } from "./HistoryTable";
import type { Locale } from "@/i18n/locale";

function render(locale: Locale, messages: typeof ro | typeof en, props: HistoryTableProps) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <HistoryTable {...props} />
    </NextIntlClientProvider>,
  );
}

const props: HistoryTableProps = {
  fields: [{ fieldKey: "nav_per_unit", labelRo: "VUAN", labelEn: "NAV per unit" }],
  rows: [
    { reportDate: "2026-09-22", values: { nav_per_unit: "11.171" } },
    { reportDate: "2026-09-21", values: { nav_per_unit: null } },
  ],
};

describe("HistoryTable", () => {
  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("renders the date column header, field header and formatted values for locale %s", (locale, messages) => {
    const html = render(locale, messages, props);
    expect(html).toContain(messages.EtfDetail.dateColumn);
    expect(html).toContain(locale === "ro" ? "VUAN" : "NAV per unit");
    expect(html).toContain(locale === "ro" ? "22.09.2026" : "2026-09-22");
    expect(html).toContain(locale === "ro" ? "11,171" : "11.171");
  });

  it("a null value renders exactly an empty <td>", () => {
    const html = render("en", en, props);
    expect(html).toContain("<td>2026-09-21</td><td></td>");
  });

  it("row order follows the props order (newest first, as the read model provides)", () => {
    const html = render("en", en, props);
    expect(html.indexOf("2026-09-22")).toBeLessThan(html.indexOf("2026-09-21"));
  });

  it("never contains a grouping character in either locale", () => {
    const bigProps: HistoryTableProps = {
      fields: [{ fieldKey: "units", labelRo: "Unități", labelEn: "Units" }],
      rows: [{ reportDate: "2026-09-22", values: { units: "1234567890.12" } }],
    };
    for (const [locale, messages] of [["ro", ro], ["en", en]] as const) {
      const html = render(locale, messages, bigProps);
      expect(html).not.toMatch(/[  ']/);
    }
  });
});
