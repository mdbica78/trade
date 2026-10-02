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
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <HomeTable {...props} />
    </NextIntlClientProvider>,
  );
}

const viewModel: HomeTableViewModel = {
  columns: [{ fieldKey: "nav_per_unit", labelRo: "VUAN", labelEn: "NAV per unit" }],
  rows: [
    {
      symbol: "BTBETRETF",
      name: "BT Butan ETF",
      adapterAvailable: true,
      latestPdfUrl: "https://bvb.ro/report.pdf",
      valueDate: "2026-09-22",
      cells: { nav_per_unit: { tracked: true, value: "11.171", delta: null } },
    },
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

  it("AC3: each row's name renders in its own element under the symbol", () => {
    const html = render("en", en, { status: "ok", viewModel });
    expect(html).toContain('<div data-home-name="true">BT Butan ETF</div>');
    expect(html).toContain('<div data-home-name="true">No Adapter ETF</div>');
    expect(html).toContain('<span data-extraction-unavailable="true">');
  });

  it("AC1: every row (with or without an adapter) has exactly one link to its /etf/ detail page, marked as the row's stretched link", () => {
    const html = render("en", en, { status: "ok", viewModel });
    expect(html.match(/href="\/etf\/BTBETRETF"/g)).toHaveLength(1);
    expect(html.match(/href="\/etf\/NOADAPTER"/g)).toHaveLength(1);
    expect(html).toContain('data-home-row-link="true"');
    // the row link is the only /etf/ link and it is not the PDF link (which opens a new tab)
    expect(html.match(/data-home-row-link="true"[^>]*target="_blank"/)).toBeNull();
  });

  it("AC2: the PDF button appears only when latestPdfUrl is set, separate from the row link", () => {
    const html = render("en", en, { status: "ok", viewModel });
    expect(html).toContain('href="https://bvb.ro/report.pdf" target="_blank" rel="noopener noreferrer" data-home-pdf-link="true"');
    expect(html).toContain(en.Home.pdfLinkLabel.replace("{symbol}", "BTBETRETF"));
    // NOADAPTER has no latestPdfUrl: exactly one PDF button in the whole table, for BTBETRETF
    expect(html.match(/data-home-pdf-link/g)).toHaveLength(1);
    const noPdfRow = html.split('href="/etf/NOADAPTER"')[1].split("</tr>")[0];
    expect(noPdfRow).not.toContain('target="_blank"');
  });

  it("AC1: the detail URL encodes a symbol with a reserved character", () => {
    const html = render("en", en, {
      status: "ok",
      viewModel: { columns: viewModel.columns, rows: [{ ...viewModel.rows[0], symbol: "A/B" }] },
    });
    expect(html).toContain('href="/etf/A%2FB"');
    expect(html.match(/data-home-row-link/g)).toHaveLength(1);
  });

  it.each([
    ["ro", ro, en] as const,
    ["en", en, ro] as const,
  ])("AC2/AC12: the PDF button's accessible name is localized in %s", (locale, messages, other) => {
    const html = render(locale, messages, { status: "ok", viewModel });
    expect(html).toContain(`aria-label="${messages.Home.pdfLinkLabel.replace("{symbol}", "BTBETRETF")}"`);
    expect(html).not.toContain(other.Home.pdfLinkLabel.replace("{symbol}", "BTBETRETF"));
  });

  it("HT-L (US-030 AC4): a no-adapter row with a stored link still shows the PDF button, plus the marker", () => {
    const noAdapterLinkedViewModel: HomeTableViewModel = {
      columns: viewModel.columns,
      rows: [
        {
          symbol: "NOADAPTERLINK",
          name: "No Adapter Link ETF",
          adapterAvailable: false,
          latestPdfUrl: "https://bvb.ro/no-adapter-report.pdf",
          valueDate: null,
          cells: { nav_per_unit: { tracked: false } },
        },
      ],
    };
    const enHtml = render("en", en, { status: "ok", viewModel: noAdapterLinkedViewModel });
    expect(enHtml).toContain('href="https://bvb.ro/no-adapter-report.pdf" target="_blank" rel="noopener noreferrer" data-home-pdf-link="true"');
    expect(enHtml).toContain(en.Home.extractionUnavailable);

    const roHtml = render("ro", ro, { status: "ok", viewModel: noAdapterLinkedViewModel });
    expect(roHtml).toContain(ro.Home.extractionUnavailable);
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

  it("source scan: HomeTable stays a server component with no onClick handler (review §2, Decided)", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile(new URL("./HomeTable.tsx", import.meta.url), "utf8");
    expect(src).not.toContain('"use client"');
    expect(src).not.toMatch(/\son[A-Z]\w*=/);
  });
});

describe("HomeTable deltas (US-017 AC6, rewritten US-036 AC5/AC6/AC7)", () => {
  const deltaViewModel: HomeTableViewModel = {
    columns: [{ fieldKey: "nav_per_unit", labelRo: "VUAN", labelEn: "NAV per unit" }],
    rows: [
      {
        symbol: "BOTHDELTAS",
        name: "Both Deltas",
        adapterAvailable: true,
        latestPdfUrl: null,
        valueDate: "2026-09-22",
        cells: {
          nav_per_unit: {
            tracked: true,
            value: "11.091",
            delta: { absolute: "0.006", percent: "0.05", previousDate: "2026-09-19" },
          },
        },
      },
      {
        symbol: "ABSONLY",
        name: "Abs Only",
        adapterAvailable: true,
        latestPdfUrl: null,
        valueDate: "2026-09-22",
        cells: {
          nav_per_unit: {
            tracked: true,
            value: "5",
            delta: { absolute: "5", percent: null, previousDate: "2026-09-19" },
          },
        },
      },
      {
        symbol: "NODELTA",
        name: "No Delta",
        adapterAvailable: true,
        latestPdfUrl: null,
        valueDate: "2026-09-22",
        cells: { nav_per_unit: { tracked: true, value: "11.171", delta: null } },
      },
      {
        symbol: "LOSS",
        name: "Loss",
        adapterAvailable: true,
        latestPdfUrl: null,
        valueDate: "2026-09-22",
        cells: { nav_per_unit: { tracked: true, value: "9.500", delta: { absolute: "-0.500", percent: "-5.00", previousDate: "2026-09-20" } } },
      },
      {
        symbol: "FLAT",
        name: "Flat",
        adapterAvailable: true,
        latestPdfUrl: null,
        valueDate: "2026-09-22",
        cells: { nav_per_unit: { tracked: true, value: "10", delta: { absolute: "0", percent: "0.00", previousDate: "2026-09-20" } } },
      },
    ],
  };

  /** Returns the row's change-line `<div ... data-home-change>` markup, or "" if absent. */
  function changeLineFor(html: string, symbol: string): string {
    const rowStart = html.indexOf(`>${symbol}<`);
    const rowEnd = html.indexOf("</tr>", rowStart);
    const row = html.slice(rowStart, rowEnd);
    const attrIdx = row.indexOf("data-home-change");
    if (attrIdx === -1) return "";
    const start = row.lastIndexOf("<div", attrIdx);
    const end = row.indexOf("</div>", attrIdx) + "</div>".length;
    return row.slice(start, end);
  }

  it.each([
    ["ro", ro, "11,091", "+0,006", "+0,05%"] as const,
    ["en", en, "11.091", "+0.006", "+0.05%"] as const,
  ])("cell with both deltas shows value, then arrow, then absolute, then percentage (%s)", (locale, messages, value, abs, pct) => {
    const html = render(locale, messages, { status: "ok", viewModel: deltaViewModel });
    const valueIdx = html.indexOf(value);
    const line = changeLineFor(html, "BOTHDELTAS");
    expect(valueIdx).toBeGreaterThanOrEqual(0);
    expect(line.indexOf("▲")).toBeGreaterThanOrEqual(0);
    expect(line.indexOf("▲")).toBeLessThan(line.indexOf(abs));
    expect(line.indexOf(abs)).toBeGreaterThanOrEqual(0);
    expect(line.indexOf(abs)).toBeLessThan(line.indexOf(pct));
    expect(valueIdx).toBeLessThan(html.indexOf(line));
  });

  it.each([
    ["ro", ro, en, "22.09.2026"] as const,
    ["en", en, ro, "2026-09-22"] as const,
  ])("AC7/AC12: value date and all direction texts render in %s only", (locale, messages, other, date) => {
    const html = render(locale, messages, { status: "ok", viewModel: deltaViewModel });
    expect(html).toContain(`<td data-home-numeric="true">${date}</td>`);
    for (const [symbol, key] of [
      ["BOTHDELTAS", "arrowUp"],
      ["LOSS", "arrowDown"],
      ["FLAT", "arrowFlat"],
    ] as const) {
      const line = changeLineFor(html, symbol);
      expect(line).toContain(`<span class="sr-only">${messages.Home[key]}</span>`);
      expect(line).not.toContain(other.Home[key]);
    }
  });

  it("AC6: the arrow carries translated accessible text, not just a glyph", () => {
    const html = render("en", en, { status: "ok", viewModel: deltaViewModel });
    const line = changeLineFor(html, "BOTHDELTAS");
    expect(line).toContain("▲");
    expect(line).toContain(`<span class="sr-only">${en.Home.arrowUp}</span>`);
  });

  it("AC6: loss and flat lines use their own glyph, tone and translated direction", () => {
    const html = render("en", en, { status: "ok", viewModel: deltaViewModel });
    const loss = changeLineFor(html, "LOSS");
    expect(loss).toContain('class="delta-loss"');
    expect(loss).toContain("▼");
    expect(loss).toContain(`<span class="sr-only">${en.Home.arrowDown}</span>`);
    expect(loss).toContain("-0.500 -5.00%");
    const flat = changeLineFor(html, "FLAT");
    expect(flat).toContain('class="delta-flat"');
    expect(flat).toContain("–");
    expect(flat).not.toContain("▲");
    expect(flat).not.toContain("▼");
    expect(flat).toContain(`<span class="sr-only">${en.Home.arrowFlat}</span>`);
  });

  it("AC6: arrow-only remains accessible, and a zero divisor has no percent", () => {
    const html = render("en", en, {
      status: "ok",
      viewModel: {
        ...deltaViewModel,
        columns: [{ ...deltaViewModel.columns[0], showAbsolute: false, showPercent: false, showArrow: true }],
      },
    });

    const arrowOnly = changeLineFor(html, "BOTHDELTAS");
    expect(arrowOnly).toContain(en.Home.arrowUp);
    expect(arrowOnly).not.toContain("+0.006");
    expect(arrowOnly).not.toContain("%");
    expect(changeLineFor(render("en", en, { status: "ok", viewModel: deltaViewModel }), "ABSONLY")).not.toContain("%");
  });

  it("AC5/AC6: direction does not round a very small exact change down to flat", () => {
    const tiny = `0.${"0".repeat(400)}1`;
    for (const [symbol, absolute, tone, arrow] of [
      ["TINYGAIN", tiny, "delta-gain", "▲"],
      ["TINYLOSS", `-${tiny}`, "delta-loss", "▼"],
    ]) {
      const html = render("en", en, {
        status: "ok",
        viewModel: {
          columns: deltaViewModel.columns,
          rows: [{
            symbol,
            name: symbol,
            adapterAvailable: true,
            latestPdfUrl: null,
            valueDate: "2026-09-22",
            cells: { nav_per_unit: { tracked: true, value: "1", delta: { absolute, percent: "0.00", previousDate: "2026-09-20" } } },
          }],
        },
      });
      expect(changeLineFor(html, symbol)).toContain(`class="${tone}"`);
      expect(changeLineFor(html, symbol)).toContain(arrow);
    }
  });

  it("AC6: title names the previous report date (P5 format)", () => {
    const enHtml = render("en", en, { status: "ok", viewModel: deltaViewModel });
    const line = changeLineFor(enHtml, "BOTHDELTAS");
    expect(line).toContain(en.Home.previousDateTitle.replace("{date}", "2026-09-19"));

    const roHtml = render("ro", ro, { status: "ok", viewModel: deltaViewModel });
    const roLine = changeLineFor(roHtml, "BOTHDELTAS");
    expect(roLine).toContain(ro.Home.previousDateTitle.replace("{date}", "19.09.2026"));
  });

  it("cell with an absolute delta only has no % in that row's change line", () => {
    const html = render("en", en, { status: "ok", viewModel: deltaViewModel });
    const line = changeLineFor(html, "ABSONLY");
    expect(line).toContain("+5");
    expect(line).not.toContain("%");
  });

  it("a null delta renders no change line at all", () => {
    const html = render("en", en, { status: "ok", viewModel: deltaViewModel });
    expect(changeLineFor(html, "NODELTA")).toBe("");
  });

  it("US-047: hides arrow, absolute and percent independently while leaving the value intact", () => {
    const html = render("en", en, {
      status: "ok",
      viewModel: {
        ...deltaViewModel,
        columns: [{
          fieldKey: "nav_per_unit",
          labelRo: "VUAN",
          labelEn: "NAV per unit",
          showAbsolute: false,
          showPercent: false,
          showArrow: false,
        }],
      },
    });
    expect(changeLineFor(html, "BOTHDELTAS")).toBe("");
    expect(html).toContain("11.091");
  });

  it.each([
    [false, true, false, true],
    [true, false, true, false],
  ])("US-047: independently applies absolute=%s and percent=%s", (showAbsolute, showPercent, hasAbsolute, hasPercent) => {
    const html = render("en", en, {
      status: "ok",
      viewModel: {
        ...deltaViewModel,
        columns: [{
          fieldKey: "nav_per_unit",
          labelRo: "VUAN",
          labelEn: "NAV per unit",
          showAbsolute,
          showPercent,
        }],
      },
    });
    const line = changeLineFor(html, "BOTHDELTAS");
    expect(line.includes("+0.006")).toBe(hasAbsolute);
    expect(line.includes("+0.05%")).toBe(hasPercent);
  });
});
