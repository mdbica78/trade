import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import { discoverLatestReport } from "../extraction/discovery";
import { downloadReportPdf, extractPdfText } from "../extraction/pdf";
import { detectAdapter } from "../config/detect-adapter";
import { formatRunLog, summarizeRun } from "./job-run-summary";
import { ingestEtf, type IngestDeps, type IngestEtfInput } from "./ingest-etf";
import { MAX_REQUESTS_PER_ETF } from "./run-daily";
import type { ReportStore } from "./store";

const FIXTURES_DIR = path.join(__dirname, "../../test/fixtures");
const BVB_FIXTURES_DIR = path.join(FIXTURES_DIR, "bvb");

const BTBETRETF_PAGE_URL = "https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=BTBETRETF";
const BTBETRETF_PDF_URL =
  "https://bvb.ro/infocont/infocont26/BTBETRETF_20260923092427_VUAN-BT-Index-Rom-nia-ETF-BET-TR-22-09-2026.pdf";
const ICBETNETF_PAGE_URL = "https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=ICBETNETF";
const ICBETNETF_PDF_URL =
  "https://bvb.ro/infocont/infocont26/ICBETNETF_20260925110032_2026-09-24-BET-ETF-Official-NAV.pdf";

function readText(dir: string, name: string): string {
  return readFileSync(path.join(dir, name), "utf8");
}

function readBytes(name: string): Uint8Array<ArrayBuffer> {
  const buf = readFileSync(path.join(FIXTURES_DIR, name));
  const out = new Uint8Array(buf.byteLength);
  out.set(buf);
  return out;
}

type Recorded = { url: string; method: string; headers: Record<string, string> };

/** A recording fetch fake: exact-URL routing, records method/headers/url for every call. */
function makeFetch(routes: Record<string, () => Response>): { fetchImpl: typeof fetch; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const headers: Record<string, string> = {};
    if (init?.headers) {
      for (const [k, v] of Object.entries(init.headers as Record<string, string>)) headers[k] = v;
    }
    calls.push({ url, method: init?.method ?? "GET", headers });
    const build = routes[url];
    if (!build) {
      return new Response("not found", { status: 404 });
    }
    return build();
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function inMemoryStore(): ReportStore {
  const reports = new Map<string, { id: number; status: string }>();
  let nextId = 1;
  return {
    async findReport(etfId, reportDate) {
      return reports.get(`${etfId}:${reportDate}`);
    },
    async saveReport(input) {
      const key = `${input.etfId}:${input.reportDate}`;
      const existing = reports.get(key);
      if (existing?.status === "ok") {
        return { status: "already_ok" };
      }
      const id = existing?.id ?? nextId++;
      reports.set(key, { id, status: input.status });
      return { status: "written", reportId: id };
    },
  };
}

function makeDeps(fetchImpl: typeof fetch, store: ReportStore): IngestDeps {
  return {
    discover: (etf) => discoverLatestReport(etf, { fetchImpl }),
    download: (url) => downloadReportPdf(url, { fetchImpl }),
    extractText: extractPdfText,
    registry: defaultAdapterRegistry,
    store,
  };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("global fetch must not be used directly in this test");
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AX-1: ICBETNETF happy path makes exactly the discovery + download requests", () => {
  it("records [GET page, GET PDF], both to https://bvb.ro, GET only, no body/cookie/content-type", async () => {
    const html = readText(BVB_FIXTURES_DIR, "ICBETNETF-instrument-2026-09-27.html");
    const pdfBytes = readBytes("ICBETNETF-2026-09-24.pdf");
    const { fetchImpl, calls } = makeFetch({
      [ICBETNETF_PAGE_URL]: () => new Response(html, { status: 200, headers: { "content-type": "text/html" } }),
      [ICBETNETF_PDF_URL]: () => new Response(pdfBytes, { status: 200, headers: { "content-type": "application/pdf" } }),
    });

    const etf: IngestEtfInput = {
      id: 1,
      symbol: "ICBETNETF",
      bvbUrl: ICBETNETF_PAGE_URL,
      adapterKey: "intercapital-nav",
      trackedFieldKeys: ["nav_per_unit", "units_in_circulation"],
    };
    const outcome = await ingestEtf(etf, makeDeps(fetchImpl, inMemoryStore()));

    expect(outcome.code).toBe("ok");
    expect(calls.map((c) => c.url)).toEqual([ICBETNETF_PAGE_URL, ICBETNETF_PDF_URL]);
    for (const call of calls) {
      expect(call.method).toBe("GET");
      expect(new URL(call.url).origin).toBe("https://bvb.ro");
      expect(call.headers["Content-Type"]).toBeUndefined();
      expect(call.headers["Cookie"]).toBeUndefined();
    }
  });
});

describe("AX-2: sentinel cookie / hidden-field values never leak", () => {
  const SENTINEL_COOKIE = "SENTINELCOOKIE7731";
  const SENTINEL_HIDDEN = "SENTINELHIDDEN4419";

  function sentinelHtml(): string {
    const html = readText(BVB_FIXTURES_DIR, "ICBETNETF-instrument-2026-09-27.html");
    // The fixture has no __VIEWSTATE field (it wasn't captured on a postback page), so this
    // proves the sentinel is absent from every place it could otherwise have leaked.
    return `<!-- __VIEWSTATE ${SENTINEL_HIDDEN} --> ${html}`;
  }

  async function runWithSentinels(pdfOk: boolean) {
    const pdfBytes = readBytes("ICBETNETF-2026-09-24.pdf");
    const { fetchImpl, calls } = makeFetch({
      [ICBETNETF_PAGE_URL]: () =>
        new Response(sentinelHtml(), {
          status: 200,
          headers: { "content-type": "text/html", "set-cookie": `ASP.NET_SessionId=${SENTINEL_COOKIE}` },
        }),
      [ICBETNETF_PDF_URL]: () =>
        pdfOk
          ? new Response(pdfBytes, { status: 200, headers: { "content-type": "application/pdf" } })
          : new Response("boom", { status: 500 }),
    });

    const etf: IngestEtfInput = {
      id: 1,
      symbol: "ICBETNETF",
      bvbUrl: ICBETNETF_PAGE_URL,
      adapterKey: "intercapital-nav",
      trackedFieldKeys: ["nav_per_unit"],
    };
    const outcome = await ingestEtf(etf, makeDeps(fetchImpl, inMemoryStore()));
    const summary = summarizeRun([{ symbol: "ICBETNETF", outcome }]);
    const log = formatRunLog([{ symbol: "ICBETNETF", outcome }], summary, []);

    return { outcome, log, calls };
  }

  it("happy path: no sentinel in the outcome, the log, or any recorded request", async () => {
    const { outcome, log, calls } = await runWithSentinels(true);
    expect(JSON.stringify(outcome)).not.toContain(SENTINEL_COOKIE);
    expect(JSON.stringify(outcome)).not.toContain(SENTINEL_HIDDEN);
    expect(log).not.toContain(SENTINEL_COOKIE);
    expect(log).not.toContain(SENTINEL_HIDDEN);
    for (const call of calls) {
      expect(JSON.stringify(call)).not.toContain(SENTINEL_COOKIE);
      expect(JSON.stringify(call)).not.toContain(SENTINEL_HIDDEN);
    }
  });

  it("PDF download fails with 500: still no sentinel anywhere", async () => {
    const { outcome, log, calls } = await runWithSentinels(false);
    expect(outcome.code).toBe("fetch_error");
    expect(JSON.stringify(outcome)).not.toContain(SENTINEL_COOKIE);
    expect(JSON.stringify(outcome)).not.toContain(SENTINEL_HIDDEN);
    expect(log).not.toContain(SENTINEL_COOKIE);
    expect(log).not.toContain(SENTINEL_HIDDEN);
    for (const call of calls) {
      expect(JSON.stringify(call)).not.toContain(SENTINEL_COOKIE);
      expect(JSON.stringify(call)).not.toContain(SENTINEL_HIDDEN);
    }
  });
});

describe("button missing (DI-3 reused): no download beyond discovery", () => {
  it("gives 'missing', no PDF request", async () => {
    const html = readText(BVB_FIXTURES_DIR, "ICBETNETF-instrument-2026-09-27.html");
    const tableMatch = /<table[^>]*\bid=(["'])gv5News\1[^>]*>([\s\S]*?)<\/table>/i.exec(html);
    const strippedHtml = html.replace(tableMatch![0], tableMatch![0].replace(/<a[^>]*>[\s\S]*?<\/a>/gi, ""));
    const { fetchImpl, calls } = makeFetch({
      [ICBETNETF_PAGE_URL]: () => new Response(strippedHtml, { status: 200, headers: { "content-type": "text/html" } }),
    });

    const etf: IngestEtfInput = {
      id: 1,
      symbol: "ICBETNETF",
      bvbUrl: ICBETNETF_PAGE_URL,
      adapterKey: "intercapital-nav",
      trackedFieldKeys: [],
    };
    const outcome = await ingestEtf(etf, makeDeps(fetchImpl, inMemoryStore()));

    expect(outcome.code).toBe("missing");
    expect(calls).toHaveLength(1);
  });
});

describe("RB: the per-ETF request bound", () => {
  it("RB-1: the BRD happy path (BTBETRETF fixtures) makes exactly MAX_REQUESTS_PER_ETF calls", async () => {
    const html = readText(BVB_FIXTURES_DIR, "BTBETRETF-instrument-2026-09-23.html");
    const pdfBytes = readBytes("BTBETRETF-2026-09-22.pdf");
    const { fetchImpl, calls } = makeFetch({
      [BTBETRETF_PAGE_URL]: () => new Response(html, { status: 200, headers: { "content-type": "text/html" } }),
      [BTBETRETF_PDF_URL]: () => new Response(pdfBytes, { status: 200, headers: { "content-type": "application/pdf" } }),
    });

    const etf: IngestEtfInput = {
      id: 1,
      symbol: "BTBETRETF",
      bvbUrl: BTBETRETF_PAGE_URL,
      adapterKey: "brd-depositary",
      trackedFieldKeys: ["nav_per_unit"],
    };
    const outcome = await ingestEtf(etf, makeDeps(fetchImpl, inMemoryStore()));

    expect(outcome.code).toBe("ok");
    expect(calls).toHaveLength(MAX_REQUESTS_PER_ETF);
  });

  it("RB-2: the ICBETNETF happy path (AX-1) makes exactly MAX_REQUESTS_PER_ETF calls", async () => {
    const html = readText(BVB_FIXTURES_DIR, "ICBETNETF-instrument-2026-09-27.html");
    const pdfBytes = readBytes("ICBETNETF-2026-09-24.pdf");
    const { fetchImpl, calls } = makeFetch({
      [ICBETNETF_PAGE_URL]: () => new Response(html, { status: 200, headers: { "content-type": "text/html" } }),
      [ICBETNETF_PDF_URL]: () => new Response(pdfBytes, { status: 200, headers: { "content-type": "application/pdf" } }),
    });

    const etf: IngestEtfInput = {
      id: 1,
      symbol: "ICBETNETF",
      bvbUrl: ICBETNETF_PAGE_URL,
      adapterKey: "intercapital-nav",
      trackedFieldKeys: ["nav_per_unit"],
    };
    const outcome = await ingestEtf(etf, makeDeps(fetchImpl, inMemoryStore()));

    expect(outcome.code).toBe("ok");
    expect(calls).toHaveLength(MAX_REQUESTS_PER_ETF);
  });

  it("RB-3: failure paths each make at most MAX_REQUESTS_PER_ETF calls", async () => {
    // page 500
    {
      const { fetchImpl, calls } = makeFetch({
        [ICBETNETF_PAGE_URL]: () => new Response("boom", { status: 500 }),
      });
      const etf: IngestEtfInput = {
        id: 1,
        symbol: "ICBETNETF",
        bvbUrl: ICBETNETF_PAGE_URL,
        adapterKey: "intercapital-nav",
        trackedFieldKeys: [],
      };
      await ingestEtf(etf, makeDeps(fetchImpl, inMemoryStore()));
      expect(calls.length).toBeLessThanOrEqual(MAX_REQUESTS_PER_ETF);
    }
    // PDF 500
    {
      const html = readText(BVB_FIXTURES_DIR, "ICBETNETF-instrument-2026-09-27.html");
      const { fetchImpl, calls } = makeFetch({
        [ICBETNETF_PAGE_URL]: () => new Response(html, { status: 200, headers: { "content-type": "text/html" } }),
        [ICBETNETF_PDF_URL]: () => new Response("boom", { status: 500 }),
      });
      const etf: IngestEtfInput = {
        id: 1,
        symbol: "ICBETNETF",
        bvbUrl: ICBETNETF_PAGE_URL,
        adapterKey: "intercapital-nav",
        trackedFieldKeys: [],
      };
      await ingestEtf(etf, makeDeps(fetchImpl, inMemoryStore()));
      expect(calls.length).toBeLessThanOrEqual(MAX_REQUESTS_PER_ETF);
    }
    // not a PDF
    {
      const html = readText(BVB_FIXTURES_DIR, "ICBETNETF-instrument-2026-09-27.html");
      const { fetchImpl, calls } = makeFetch({
        [ICBETNETF_PAGE_URL]: () => new Response(html, { status: 200, headers: { "content-type": "text/html" } }),
        [ICBETNETF_PDF_URL]: () => new Response("not a pdf", { status: 200, headers: { "content-type": "text/plain" } }),
      });
      const etf: IngestEtfInput = {
        id: 1,
        symbol: "ICBETNETF",
        bvbUrl: ICBETNETF_PAGE_URL,
        adapterKey: "intercapital-nav",
        trackedFieldKeys: [],
      };
      await ingestEtf(etf, makeDeps(fetchImpl, inMemoryStore()));
      expect(calls.length).toBeLessThanOrEqual(MAX_REQUESTS_PER_ETF);
    }
  });

  it("RB-4: the add-time detectAdapter path makes at most MAX_REQUESTS_PER_ETF calls", async () => {
    const html = readText(BVB_FIXTURES_DIR, "ICBETNETF-instrument-2026-09-27.html");
    const pdfBytes = readBytes("ICBETNETF-2026-09-24.pdf");
    const { fetchImpl, calls } = makeFetch({
      [ICBETNETF_PAGE_URL]: () => new Response(html, { status: 200, headers: { "content-type": "text/html" } }),
      [ICBETNETF_PDF_URL]: () => new Response(pdfBytes, { status: 200, headers: { "content-type": "application/pdf" } }),
    });

    const result = await detectAdapter(
      { symbol: "ICBETNETF", bvbUrl: ICBETNETF_PAGE_URL },
      {
        discover: (etf) => discoverLatestReport(etf, { fetchImpl }),
        download: (url) => downloadReportPdf(url, { fetchImpl }),
        extractText: extractPdfText,
        registry: defaultAdapterRegistry,
      },
    );

    expect(result).toEqual({ adapterKey: "intercapital-nav", reason: "detected" });
    expect(calls.length).toBeLessThanOrEqual(MAX_REQUESTS_PER_ETF);
  });
});
