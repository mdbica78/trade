import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { discoverLatestReport } from "./discovery";

// US-029: ICBETNETF's report list has the same gv5News markup as the three BRD fixtures (a
// decorative <input type="submit"> plus a sibling <a href> to the real PDF) — no discovery code
// change was needed. This proves discovery keeps working for a fourth ETF, unchanged.
const FIXTURE_PATH = path.join(
  __dirname,
  "../../test/fixtures/bvb/ICBETNETF-instrument-2026-09-27.html",
);
const PAGE_URL = "https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=ICBETNETF";
const NEWEST_PDF_URL =
  "https://bvb.ro/infocont/infocont26/ICBETNETF_20260925110032_2026-09-24-BET-ETF-Official-NAV.pdf";
const SECOND_PDF_URL =
  "https://bvb.ro/infocont/infocont26/ICBETNETF_20260924110817_2026-09-23-BET-ETF-Official-NAV.pdf";

function readFixture(): string {
  return readFileSync(FIXTURE_PATH, "utf8");
}

describe("DI-1: discoverLatestReport over the real ICBETNETF fixture", () => {
  it("finds the newest report, exactly 1 request", async () => {
    const fetchImpl = vi.fn(async () => new Response(readFixture(), { status: 200 }));
    const result = await discoverLatestReport({ symbol: "ICBETNETF", bvbUrl: PAGE_URL }, { fetchImpl });

    expect(result).toMatchObject({
      status: "found",
      pdfUrl: NEWEST_PDF_URL,
      title: "VAN la data 24.09.2026",
      publishedAt: "2026-09-25T11:02",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("DI-2: the returned URL is a real row href, never a guess", () => {
  it("occurs literally as an href inside the fixture's gv5News table", () => {
    const html = readFixture();
    const gv5NewsTable = /<table[^>]*\bid=(["'])gv5News\1[^>]*>([\s\S]*?)<\/table>/i.exec(html);
    expect(gv5NewsTable).not.toBeNull();
    expect(gv5NewsTable![0]).toContain(`href='${NEWEST_PDF_URL}'`);
  });

  it("is not the prospectus, the KID, or a URL built from the symbol/bvb_url/a date", async () => {
    const fetchImpl = vi.fn(async () => new Response(readFixture(), { status: 200 }));
    const result = await discoverLatestReport({ symbol: "ICBETNETF", bvbUrl: PAGE_URL }, { fetchImpl });
    if (result.status !== "found") throw new Error("expected status: found");

    expect(result.pdfUrl).not.toContain("ICETF-Prospect");
    expect(result.pdfUrl).not.toContain("PRIIPs-KIID");
    expect(result.pdfUrl).not.toContain(new URL(PAGE_URL).search);
  });
});

describe("DI-3: falls back correctly when a row's link is missing", () => {
  it("with the newest row's <a> removed, returns the second row's own URL and its own title", async () => {
    const html = readFixture();
    const newestRowLink =
      "<a href='https://bvb.ro/infocont/infocont26/ICBETNETF_20260925110032_2026-09-24-BET-ETF-Official-NAV.pdf' target='_blank'><i class='fa fa-lg fa-file-pdf-o'></i></a>";
    expect(html).toContain(newestRowLink);
    const withoutNewestLink = html.replace(newestRowLink, "");

    const fetchImpl = vi.fn(async () => new Response(withoutNewestLink, { status: 200 }));
    const result = await discoverLatestReport({ symbol: "ICBETNETF", bvbUrl: PAGE_URL }, { fetchImpl });

    expect(result).toMatchObject({
      status: "found",
      pdfUrl: SECOND_PDF_URL,
      title: "VAN la data 23.09.2026",
    });
  });

  it("with every <a> removed from the gv5News table, gives not_found / no_report_entries, 1 request", async () => {
    const html = readFixture();
    const tableMatch = /<table[^>]*\bid=(["'])gv5News\1[^>]*>([\s\S]*?)<\/table>/i.exec(html);
    expect(tableMatch).not.toBeNull();
    const [fullTable] = tableMatch!;
    const strippedTable = fullTable.replace(/<a[^>]*>[\s\S]*?<\/a>/gi, "");
    const strippedHtml = html.replace(fullTable, strippedTable);

    const fetchImpl = vi.fn(async () => new Response(strippedHtml, { status: 200 }));
    const result = await discoverLatestReport({ symbol: "ICBETNETF", bvbUrl: PAGE_URL }, { fetchImpl });

    expect(result).toEqual({ status: "not_found", reason: "no_report_entries" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
