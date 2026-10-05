import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withoutRowsBefore, withNewestRowHrefs, rowHrefs } from "../../test/helpers/filing-page";
import {
  discoverLatestReport,
  findLatestFilingLinks,
  MAX_REPORTS_PER_FILING,
} from "./discovery";

const FIXTURES_DIR = path.join(__dirname, "../../test/fixtures/bvb");
const PAGE_URL = "https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=X";

function fixturePath(symbol: string): string {
  const matches = readdirSync(FIXTURES_DIR).filter((f) => f.startsWith(`${symbol}-instrument-`) && f.endsWith(".html"));
  expect(matches, `expected exactly one fixture for ${symbol}`).toHaveLength(1);
  return path.join(FIXTURES_DIR, matches[0]);
}

function readFixture(symbol: string): string {
  return readFileSync(fixturePath(symbol), "utf8");
}

describe("findLatestFilingLinks (US-037 D-1, AC8)", () => {
  it.each(["BTBETRETF", "TVBETETF", "PTENGETF"])(
    "FL-1: %s's three-link catch-up row, once newest, gives its three links newest first",
    (symbol) => {
      const html = withoutRowsBefore(readFixture(symbol), 3);
      const result = findLatestFilingLinks(html, PAGE_URL);
      expect(result).not.toBeNull();
      expect(result!.truncated).toBe(false);

      const rawHrefs = rowHrefs(html, 0);
      expect(rawHrefs).toHaveLength(3);
      expect(result!.links.map((l) => l.pdfUrl)).toEqual([...rawHrefs].reverse());
      expect(result!.links[0].pdfUrl).toContain("20-09-2026.pdf");
      expect(result!.links[1].pdfUrl).toContain("19-09-2026.pdf");
      expect(result!.links[2].pdfUrl).toContain("18-09-2026.pdf");
    },
  );

  it("FL-3: a row with more hrefs than the cap keeps the newest MAX_REPORTS_PER_FILING, truncated true", () => {
    const html = withNewestRowHrefs(
      readFixture("BTBETRETF"),
      Array.from({ length: MAX_REPORTS_PER_FILING + 2 }, (_, i) => `https://bvb.ro/x/report-${i}.pdf`),
    );
    const result = findLatestFilingLinks(html, PAGE_URL);
    expect(result).not.toBeNull();
    expect(result!.truncated).toBe(true);
    expect(result!.links).toHaveLength(MAX_REPORTS_PER_FILING);
    // Same row, no publishedAt tie-break available: comparator falls back to later-in-row wins, so
    // the highest-indexed hrefs (kept first, newest-first) are the ones under the cap.
    expect(result!.links[0].pdfUrl).toBe(`https://bvb.ro/x/report-${MAX_REPORTS_PER_FILING + 1}.pdf`);
  });

  it("FL-3b: a repeated href in one row is de-duplicated, kept once", () => {
    const html = withNewestRowHrefs(readFixture("BTBETRETF"), [
      "https://bvb.ro/x/a.pdf",
      "https://bvb.ro/x/a.pdf",
      "https://bvb.ro/x/b.pdf",
    ]);
    const result = findLatestFilingLinks(html, PAGE_URL);
    expect(result!.links.map((l) => l.pdfUrl).sort()).toEqual(["https://bvb.ro/x/a.pdf", "https://bvb.ro/x/b.pdf"].sort());
    expect(result!.links).toHaveLength(2);
  });

  it("FL-3c: no report row at all gives null", () => {
    const html = withoutRowsBefore(readFixture("BTBETRETF"), 100);
    expect(findLatestFilingLinks(html, PAGE_URL)).toBeNull();
  });

  it("FL-4: discoverLatestReport's found result carries links/truncated matching links[0]", async () => {
    const html = readFixture("BTBETRETF");
    const single = findLatestFilingLinks(html, PAGE_URL)!.links[0];
    const result = await discoverLatestReport(
      { symbol: "BTBETRETF", bvbUrl: PAGE_URL },
      { fetchImpl: (async () => new Response(html, { status: 200 })) as unknown as typeof fetch },
    );
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.pdfUrl).toBe(single.pdfUrl);
      expect(result.title).toBe(single.title);
      expect(result.publishedAt).toBe(single.publishedAt);
      expect(result.links).toBeDefined();
      expect(result.links[0]).toEqual(single);
      expect(result.truncated).toBe(false);
    }
  });
});
