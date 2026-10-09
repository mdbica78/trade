import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedEtfs } from "../db/seed-data";
import { discoverLatestReport, findLatestReportLink, parseReportList } from "./discovery";

const FIXTURES_DIR = path.join(__dirname, "../../test/fixtures/bvb");

// Expected values below are copied from test/fixtures/bvb/README.md §7 (read off the raw HTML
// by hand, before the parser existed).
const EXPECTED = {
  BTBETRETF: {
    pdfUrl:
      "https://bvb.ro/infocont/infocont26/BTBETRETF_20260923092427_VUAN-BT-Index-Rom-nia-ETF-BET-TR-22-09-2026.pdf",
    publishedAt: "2026-09-23T09:25",
  },
  TVBETETF: {
    pdfUrl:
      "https://bvb.ro/infocont/infocont26/TVBETETF_20260923090730_VUAN-ETF-BET-Patria---Tradeville-22-09-2026.pdf",
    publishedAt: "2026-09-23T09:09",
  },
  PTENGETF: {
    pdfUrl:
      "https://bvb.ro/infocont/infocont26/PTENGETF_20260923090816_VUAN-ETF-Energie-Patria-Tradeville-22-09-2026.pdf",
    publishedAt: "2026-09-23T09:10",
  },
} as const;

function fixturePath(symbol: string): string {
  const matches = readdirSync(FIXTURES_DIR).filter(
    (f) => f.startsWith(`${symbol}-instrument-`) && f.endsWith(".html"),
  );
  expect(matches, `expected exactly one fixture for ${symbol}`).toHaveLength(1);
  return path.join(FIXTURES_DIR, matches[0]);
}

function readFixture(symbol: string): string {
  return readFileSync(fixturePath(symbol), "utf8");
}

function bvbUrlFor(symbol: string): string {
  const etf = seedEtfs.find((e) => e.symbol === symbol);
  if (!etf) throw new Error(`no seed ETF for ${symbol}`);
  return etf.bvbUrl;
}

type Row = { title: string; date?: string; hrefs: string[] };

/** Same row markup as the real fixtures (test/fixtures/bvb/README.md §2), templated per row. */
function buildPage(rows: Row[]): string {
  const rowsHtml = rows
    .map(
      (r) => `
        <tr><td>
          <div class="col-lg-10 col-xs-10 pLeft0">
            <input type="submit" name="ctl00$body$x" value="${r.title}" onclick="aspnetForm.target =&#39;_blank&#39;;" id="btn" class="mLnkbttS" />
            ${r.date ? `<p class="date mBot0">${r.date}</p>` : ""}
          </div>
          <div class="col-lg-2 col-xs-2 text-right pTop10 pRight0">
            ${r.hrefs.map((h) => `<a href='${h}' target='_blank'><i class='fa fa-lg fa-file-pdf-o'></i></a>`).join(" ")}
          </div>
        </td></tr>`,
    )
    .join("");
  return `<html><body>
    <div id="ctl00_body_ctl02_Top5NewsPerSymbol_divNews">
      <h2 class="styled">Stiri</h2>
      <table class="table dataTable no-footer generic-table compact" id="gv5News" width="100%">
        <thead><tr><th scope="col">&nbsp;</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  </body></html>`;
}

const PAGE_URL = "https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=TEST";

describe("fixtures (AC1)", () => {
  for (const symbol of ["BTBETRETF", "TVBETETF", "PTENGETF"]) {
    it(`has exactly one non-empty committed fixture for ${symbol}`, () => {
      const html = readFixture(symbol);
      expect(html.length).toBeGreaterThan(0);
    });
  }
});

describe("real fixtures (AC2)", () => {
  for (const symbol of ["BTBETRETF", "TVBETETF", "PTENGETF"] as const) {
    it(`findLatestReportLink returns the README's expected URL for ${symbol}`, () => {
      const html = readFixture(symbol);
      const pageUrl = bvbUrlFor(symbol);
      const link = findLatestReportLink(html, pageUrl);
      expect(link).not.toBeNull();
      expect(link!.pdfUrl).toBe(EXPECTED[symbol].pdfUrl);
      expect(link!.title).not.toBe("");
      expect(link!.publishedAt).toBe(EXPECTED[symbol].publishedAt);
      expect(new URL(link!.pdfUrl).protocol).toBe("https:");
    });
  }
});

describe("ordering and filtering (AC3)", () => {
  it("returns the most recent of several reports listed out of chronological order", () => {
    const html = buildPage([
      { title: "VAN la data 20.09.2026", date: "21.09.2026 9:00:00", hrefs: ["https://bvb.ro/infocont/D-2.pdf"] },
      { title: "VAN la data 22.09.2026", date: "23.09.2026 9:00:00", hrefs: ["https://bvb.ro/infocont/D.pdf"] },
      { title: "VAN la data 21.09.2026", date: "22.09.2026 9:00:00", hrefs: ["https://bvb.ro/infocont/D-1.pdf"] },
    ]);
    const link = findLatestReportLink(html, PAGE_URL);
    expect(link?.pdfUrl).toBe("https://bvb.ro/infocont/D.pdf");
  });

  it("ignores a non-report entry even when it is newest and has its own PDF link, placed first", () => {
    const html = buildPage([
      { title: "Anunt corporativ", date: "24.09.2026 8:00:00", hrefs: ["https://bvb.ro/infocont/not-a-report.pdf"] },
      { title: "VAN la data 20.09.2026", date: "21.09.2026 9:00:00", hrefs: ["https://bvb.ro/infocont/D-2.pdf"] },
      { title: "VAN la data 22.09.2026", date: "23.09.2026 9:00:00", hrefs: ["https://bvb.ro/infocont/D.pdf"] },
      { title: "VAN la data 21.09.2026", date: "22.09.2026 9:00:00", hrefs: ["https://bvb.ro/infocont/D-1.pdf"] },
    ]);
    const link = findLatestReportLink(html, PAGE_URL);
    expect(link?.pdfUrl).toBe("https://bvb.ro/infocont/D.pdf");
  });

  it("returns null when every entry is non-report news, even with PDF links", () => {
    const html = buildPage([
      { title: "Anunt corporativ", date: "24.09.2026 8:00:00", hrefs: ["https://bvb.ro/infocont/a.pdf"] },
      { title: "Dividend anuntat", date: "23.09.2026 8:00:00", hrefs: ["https://bvb.ro/infocont/b.pdf"] },
    ]);
    expect(findLatestReportLink(html, PAGE_URL)).toBeNull();
  });

  it("breaks a publishedAt tie by document order (first wins)", () => {
    const html = buildPage([
      { title: "VAN la data 22.09.2026 (A)", date: "23.09.2026 9:00:00", hrefs: ["https://bvb.ro/infocont/first.pdf"] },
      { title: "VAN la data 22.09.2026 (B)", date: "23.09.2026 9:00:00", hrefs: ["https://bvb.ro/infocont/second.pdf"] },
    ]);
    const link = findLatestReportLink(html, PAGE_URL);
    expect(link?.pdfUrl).toBe("https://bvb.ro/infocont/first.pdf");
  });

  it("prefers a dated report over an undated one, regardless of order", () => {
    const html = buildPage([
      { title: "VAN la data 22.09.2026", date: "23.09.2026 9:00:00", hrefs: ["https://bvb.ro/infocont/dated.pdf"] },
      { title: "VAN la data 21.09.2026", hrefs: ["https://bvb.ro/infocont/undated.pdf"] },
    ]);
    const link = findLatestReportLink(html, PAGE_URL);
    expect(link?.pdfUrl).toBe("https://bvb.ro/infocont/dated.pdf");
  });

  it("within a catch-up row sharing one title/date, the later link in the row wins (README §2)", () => {
    const html = buildPage([
      {
        title: "VAN la data 18/19/20.09.2026",
        date: "21.09.2026 9:34:13",
        hrefs: [
          "https://bvb.ro/infocont/18-09.pdf",
          "https://bvb.ro/infocont/19-09.pdf",
          "https://bvb.ro/infocont/20-09.pdf",
        ],
      },
    ]);
    const link = findLatestReportLink(html, PAGE_URL);
    expect(link?.pdfUrl).toBe("https://bvb.ro/infocont/20-09.pdf");
  });
});

describe("no report (AC4)", () => {
  it("findLatestReportLink is null when a real fixture's list is emptied", () => {
    const html = readFixture("BTBETRETF");
    const marker = '<tbody>';
    const idx = html.indexOf('id="gv5News"');
    expect(idx, "gv5News table not found in fixture").toBeGreaterThan(-1);
    const tbodyIdx = html.indexOf(marker, idx);
    expect(tbodyIdx, "tbody not found after gv5News table start").toBeGreaterThan(-1);
    const closeIdx = html.indexOf("</tbody>", tbodyIdx);
    expect(closeIdx, "</tbody> not found").toBeGreaterThan(-1);
    const emptied = html.slice(0, tbodyIdx + marker.length) + html.slice(closeIdx);
    expect(findLatestReportLink(emptied, bvbUrlFor("BTBETRETF"))).toBeNull();
  });

  it("discoverLatestReport gives not_found with no pdfUrl when served by a mocked fetch", async () => {
    const html = buildPage([]);
    const fetchImpl = vi.fn(async () => new Response(html, { status: 200 }));
    const result = await discoverLatestReport(
      { symbol: "TEST", bvbUrl: PAGE_URL },
      { fetchImpl },
    );
    expect(result.status).toBe("not_found");
    expect(result).not.toHaveProperty("pdfUrl");
  });

  it("gives list_not_found when the list container itself is missing", () => {
    const html = "<html><body><p>unrelated page</p></body></html>";
    expect(findLatestReportLink(html, PAGE_URL)).toBeNull();
    const parsed = parseReportList(html, PAGE_URL);
    expect(parsed.listFound).toBe(false);
  });
});

describe("href resolution (AC5)", () => {
  it("resolves relative hrefs against pageUrl and passes absolute ones through", () => {
    const html = buildPage([
      { title: "VAN la data 1", date: "23.09.2026 9:00:00", hrefs: ["/infocont/x.pdf"] },
      { title: "VAN la data 2", date: "22.09.2026 9:00:00", hrefs: ["x.pdf"] },
      { title: "VAN la data 3", date: "21.09.2026 9:00:00", hrefs: ["../x.pdf"] },
      { title: "VAN la data 4", date: "20.09.2026 9:00:00", hrefs: ["//bvb.ro/x.pdf"] },
      { title: "VAN la data 5", date: "19.09.2026 9:00:00", hrefs: ["https://other.example/x.pdf"] },
    ]);
    const { entries } = parseReportList(html, PAGE_URL);
    const pdfUrls = entries.map((e) => e.pdfUrl);
    expect(pdfUrls).toEqual([
      "https://bvb.ro/infocont/x.pdf",
      "https://bvb.ro/FinancialInstruments/Details/x.pdf",
      "https://bvb.ro/FinancialInstruments/x.pdf",
      "https://bvb.ro/x.pdf",
      "https://other.example/x.pdf",
    ]);
  });

  it("decodes &amp; in a href before resolving it", () => {
    const html = buildPage([
      { title: "VAN la data 1", date: "23.09.2026 9:00:00", hrefs: ["/infocont/x.pdf?a=1&amp;b=2"] },
    ]);
    const { entries } = parseReportList(html, PAGE_URL);
    expect(entries[0].pdfUrl).toBe("https://bvb.ro/infocont/x.pdf?a=1&b=2");
  });

  it("never treats a javascript: or # href as a candidate", () => {
    const html = buildPage([
      { title: "VAN la data 1", date: "23.09.2026 9:00:00", hrefs: ["javascript:__doPostBack('a','b')", "#"] },
    ]);
    const { entries } = parseReportList(html, PAGE_URL);
    expect(entries.every((e) => e.pdfUrl === null)).toBe(true);
    expect(findLatestReportLink(html, PAGE_URL)).toBeNull();
  });
});

describe("discoverLatestReport (AC6)", () => {
  const etf = { symbol: "TEST", bvbUrl: PAGE_URL };
  const fixtureHtml = () => buildPage([
    { title: "VAN la data 22.09.2026", date: "23.09.2026 9:00:00", hrefs: ["https://bvb.ro/infocont/latest.pdf"] },
  ]);

  it("gives found on a 2xx response", async () => {
    const fetchImpl = vi.fn(async () => new Response(fixtureHtml(), { status: 200 }));
    const result = await discoverLatestReport(etf, { fetchImpl });
    expect(result).toMatchObject({ status: "found", pdfUrl: "https://bvb.ro/infocont/latest.pdf" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("gives error/http_error with httpStatus on 404", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 404 }));
    const result = await discoverLatestReport(etf, { fetchImpl });
    expect(result).toMatchObject({ status: "error", kind: "http_error", httpStatus: 404 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("gives error/http_error with httpStatus on 500", async () => {
    const fetchImpl = vi.fn(async () => new Response("boom", { status: 500 }));
    const result = await discoverLatestReport(etf, { fetchImpl });
    expect(result).toMatchObject({ status: "error", kind: "http_error", httpStatus: 500 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("gives error/network on a rejected fetch promise", async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new TypeError("fetch failed")));
    const result = await discoverLatestReport(etf, { fetchImpl });
    expect(result).toMatchObject({ status: "error", kind: "network" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("gives error/network on a synchronous throw from fetchImpl", async () => {
    const fetchImpl = vi.fn(() => {
      throw new Error("sync boom");
    });
    const result = await discoverLatestReport(etf, { fetchImpl });
    expect(result).toMatchObject({ status: "error", kind: "network" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("gives error/timeout when slower than timeoutMs (fetch ignores the signal)", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(() => new Promise<Response>(() => {}));
    const promise = discoverLatestReport(etf, { fetchImpl, timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;
    expect(result).toMatchObject({ status: "error", kind: "timeout" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("gives error/timeout when fetch rejects with AbortError on abort", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const promise = discoverLatestReport(etf, { fetchImpl, timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;
    expect(result).toMatchObject({ status: "error", kind: "timeout" });
    vi.useRealTimers();
  });

  it("gives error/network when the body read rejects", async () => {
    const res = new Response("x", { status: 200 });
    vi.spyOn(res, "text").mockRejectedValue(new Error("read failed"));
    const fetchImpl = vi.fn(async () => res);
    const result = await discoverLatestReport(etf, { fetchImpl });
    expect(result).toMatchObject({ status: "error", kind: "network" });
  });

  it("passes BVB_REQUEST_HEADERS and a signal to fetchImpl", async () => {
    const fetchImpl = vi.fn(async () => new Response(fixtureHtml(), { status: 200 }));
    await discoverLatestReport(etf, { fetchImpl });
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[1]).toMatchObject({
      headers: expect.objectContaining({ "User-Agent": expect.stringContaining("etf-monitor2") }),
      signal: expect.any(AbortSignal),
    });
  });
});

describe("no live network access (AC7)", () => {
  let networkGuard: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    networkGuard = vi.fn(() => {
      throw new Error("network disabled in tests");
    });
    vi.stubGlobal("fetch", networkGuard);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("every mocked test above never calls the real fetch stub", () => {
    expect(networkGuard).not.toHaveBeenCalled();
  });

  it("discoverLatestReport without an explicit fetchImpl reads globalThis.fetch at call time (the stub intercepts it)", async () => {
    const html = buildPage([
      { title: "VAN la data 22.09.2026", date: "23.09.2026 9:00:00", hrefs: ["https://bvb.ro/infocont/x.pdf"] },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(html, { status: 200 })),
    );
    const result = await discoverLatestReport({ symbol: "TEST", bvbUrl: PAGE_URL });
    expect(result.status).toBe("found");
  });
});
