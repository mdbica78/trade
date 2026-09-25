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
      symbol: "BTBETRETF",
      adapterAvailable: true,
      latestPdfUrl: "https://bvb.ro/report.pdf",
      valueDate: "2026-09-22",
      cells: { nav_per_unit: { tracked: true, value: "11.171", delta: null } },
    },
    {
      symbol: "NOADAPTER",
      adapterAvailable: false,
      latestPdfUrl: null,
      valueDate: null,
      cells: { nav_per_unit: { tracked: false } },
    },
  ],
};

describe("HomeTable", () => {
  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("renders headers, the extraction-unavailable marker and formatted values for locale %s", (locale, messages) => {
    const html = render(locale, messages, { status: "ok", viewModel });
    expect(html).toContain(locale === "ro" ? "VUAN" : "NAV per unit");
    expect(html).toContain(messages.Home.extractionUnavailable);
    expect(html).toContain(locale === "ro" ? "11,171" : "11.171");
  });

  it("the symbol is a link when latestPdfUrl exists, plain text otherwise", () => {
    const html = render("en", en, { status: "ok", viewModel });
    expect(html).toContain('<a href="https://bvb.ro/report.pdf" target="_blank"');
    expect(html).toContain("<td>NOADAPTER<span>"); // no <a> wrapping NOADAPTER
    // US-018: each row also gets a separate "history" link, so a PDF link and a history link
    // are counted separately rather than asserting a single total <a> count.
    expect(html.match(/<a [^>]*target="_blank"/g)).toHaveLength(1); // exactly one PDF link, for BTBETRETF only
    expect(html.match(/href="\/etf\//g)).toHaveLength(2); // one history link per row
  });

  it("US-018 AC2: each row has a translated history link, separate from the symbol's PDF link", () => {
    const enHtml = render("en", en, { status: "ok", viewModel });
    const roHtml = render("ro", ro, { status: "ok", viewModel });
    expect(enHtml).toContain('href="/etf/BTBETRETF"');
    expect(enHtml).toContain('href="/etf/NOADAPTER"');
    expect(enHtml).toContain(">History</a>");
    expect(roHtml).toContain(">Istoric</a>");
    expect(enHtml).not.toContain(">Istoric</a>");
    // the PDF link is unchanged, still wraps the symbol only
    expect(enHtml).toContain('<a href="https://bvb.ro/report.pdf" target="_blank" rel="noopener noreferrer">BTBETRETF</a>');
  });

  it("shows the translated empty state when there are no rows", () => {
    const html = render("en", en, { status: "ok", viewModel: { columns: [], rows: [] } });
    expect(html).toContain(en.Home.empty);
  });

  it("shows the translated error message on status:error, never a raw exception string", () => {
    const html = render("en", en, { status: "error" });
    expect(html).toContain(en.Home.loadError);
  });

  it("ro and en renders never contain the other locale's differing text", () => {
    const roHtml = render("ro", ro, { status: "ok", viewModel });
    const enHtml = render("en", en, { status: "ok", viewModel });
    expect(roHtml).not.toContain(en.Home.extractionUnavailable);
    expect(enHtml).not.toContain(ro.Home.extractionUnavailable);
  });
});

describe("HomeTable deltas (US-017 AC6)", () => {
  const deltaViewModel: HomeTableViewModel = {
    columns: [{ fieldKey: "nav_per_unit", labelRo: "VUAN", labelEn: "NAV per unit" }],
    rows: [
      {
        symbol: "BOTHDELTAS",
        adapterAvailable: true,
        latestPdfUrl: null,
        valueDate: "2026-09-22",
        cells: { nav_per_unit: { tracked: true, value: "11.091", delta: { absolute: "0.006", percent: "0.05" } } },
      },
      {
        symbol: "ABSONLY",
        adapterAvailable: true,
        latestPdfUrl: null,
        valueDate: "2026-09-22",
        cells: { nav_per_unit: { tracked: true, value: "5", delta: { absolute: "5", percent: null } } },
      },
      {
        symbol: "NODELTA",
        adapterAvailable: true,
        latestPdfUrl: null,
        valueDate: "2026-09-22",
        cells: { nav_per_unit: { tracked: true, value: "11.171", delta: null } },
      },
    ],
  };

  /** Returns the row's last `<td>...</td>` (the single tracked column in `deltaViewModel`). */
  function cellTextFor(html: string, symbol: string): string {
    const rows = html.split("<tr>").slice(1);
    const row = rows.find((r) => r.includes(symbol))!;
    const body = row.slice(0, row.indexOf("</tr>"));
    const lastTdStart = body.lastIndexOf("<td>");
    return `${body.slice(lastTdStart)}</tr>`;
  }

  it.each([
    ["ro", ro, "11,091", "+0,006", "+0,05%"] as const,
    ["en", en, "11.091", "+0.006", "+0.05%"] as const,
  ])("cell with both deltas shows value, then absolute, then percentage (%s)", (locale, messages, value, abs, pct) => {
    const html = render(locale, messages, { status: "ok", viewModel: deltaViewModel });
    const cell = cellTextFor(html, "BOTHDELTAS");
    expect(cell.indexOf(value)).toBeGreaterThanOrEqual(0);
    expect(cell.indexOf(value)).toBeLessThan(cell.indexOf(abs));
    expect(cell.indexOf(abs)).toBeLessThan(cell.indexOf(pct));
  });

  it("cell with an absolute delta only has no % in that <td>", () => {
    const html = render("en", en, { status: "ok", viewModel: deltaViewModel });
    const cell = cellTextFor(html, "ABSONLY");
    expect(cell).toContain("+5");
    expect(cell).not.toContain("%");
  });

  it("a null delta renders no text: no +, -, %, 0,00 or extra element beyond the formatted value", () => {
    const html = render("en", en, { status: "ok", viewModel: deltaViewModel });
    const cell = cellTextFor(html, "NODELTA");
    expect(cell).toBe("<td>11.171</td></tr>");
  });

  it("both new title labels render in ro and never in en, and vice versa", () => {
    const roHtml = render("ro", ro, { status: "ok", viewModel: deltaViewModel });
    const enHtml = render("en", en, { status: "ok", viewModel: deltaViewModel });
    expect(roHtml).toContain(ro.Home.deltaAbsolute);
    expect(roHtml).toContain(ro.Home.deltaPercent);
    expect(enHtml).not.toContain(ro.Home.deltaAbsolute);
    expect(enHtml).toContain(en.Home.deltaAbsolute);
    expect(enHtml).toContain(en.Home.deltaPercent);
    expect(roHtml).not.toContain(en.Home.deltaAbsolute);
  });
});
