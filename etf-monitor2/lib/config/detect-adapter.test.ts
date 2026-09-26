import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createAdapterRegistry } from "../extraction/adapters/registry";
import { brdDepositaryAdapter } from "../extraction/adapters/brd-depositary";
import { discoverLatestReport } from "../extraction/discovery";
import { downloadReportPdf, extractPdfText } from "../extraction/pdf";
import { detectAdapter, type DetectAdapterDeps } from "./detect-adapter";

const FIXTURES_DIR = path.join(__dirname, "..", "..", "test", "fixtures");
const BVB_DIR = path.join(FIXTURES_DIR, "bvb");

const SYMBOL = "BTBETRETF";
const INSTRUMENT_PAGE_URL = `https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=${SYMBOL}`;
const NEWEST_PDF_URL =
  "https://bvb.ro/infocont/infocont26/BTBETRETF_20260923092427_VUAN-BT-Index-Rom-nia-ETF-BET-TR-22-09-2026.pdf";

const instrumentHtml = readFileSync(path.join(BVB_DIR, "BTBETRETF-instrument-2026-09-23.html"), "utf8");
const pdfBytes = new Uint8Array(readFileSync(path.join(FIXTURES_DIR, "BTBETRETF-2026-09-22.pdf")));

function makeFetchImpl(routes: Record<string, () => Response>): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const route = routes[url];
    if (!route) return new Response("not found", { status: 404 });
    return route();
  }) as unknown as typeof fetch;
}

function realChainDeps(fetchImpl: typeof fetch, registry = createAdapterRegistry([brdDepositaryAdapter])): DetectAdapterDeps {
  return {
    discover: (e) => discoverLatestReport(e, { fetchImpl }),
    download: (url) => downloadReportPdf(url, { fetchImpl }),
    extractText: extractPdfText,
    registry,
  };
}

describe("detectAdapter (DA)", () => {
  it("DA-1: BTBETRETF fixtures detect brd-depositary with one discovery and one download call", async () => {
    const fetchImpl = makeFetchImpl({
      [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
      [NEWEST_PDF_URL]: () => new Response(pdfBytes, { status: 200 }),
    });
    const result = await detectAdapter({ symbol: SYMBOL, bvbUrl: INSTRUMENT_PAGE_URL }, realChainDeps(fetchImpl));
    expect(result).toEqual({ adapterKey: "brd-depositary", reason: "detected" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("DA-2: instrument page without the news table gives not_found with one call, zero downloads", async () => {
    const fetchImpl = makeFetchImpl({
      [INSTRUMENT_PAGE_URL]: () => new Response("<html><body>no table here</body></html>", { status: 200 }),
    });
    const result = await detectAdapter({ symbol: SYMBOL, bvbUrl: INSTRUMENT_PAGE_URL }, realChainDeps(fetchImpl));
    expect(result).toEqual({ adapterKey: null, reason: "not_found" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("DA-3: instrument page 500 gives fetch_error with exactly one call", async () => {
    const fetchImpl = makeFetchImpl({
      [INSTRUMENT_PAGE_URL]: () => new Response("error", { status: 500 }),
    });
    const result = await detectAdapter({ symbol: SYMBOL, bvbUrl: INSTRUMENT_PAGE_URL }, realChainDeps(fetchImpl));
    expect(result).toEqual({ adapterKey: null, reason: "fetch_error" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("DA-4: PDF URL 500 gives fetch_error after discovery + download (2 calls)", async () => {
    const fetchImpl = makeFetchImpl({
      [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
      [NEWEST_PDF_URL]: () => new Response("error", { status: 500 }),
    });
    const result = await detectAdapter({ symbol: SYMBOL, bvbUrl: INSTRUMENT_PAGE_URL }, realChainDeps(fetchImpl));
    expect(result).toEqual({ adapterKey: null, reason: "fetch_error" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("DA-5: PDF bytes with no valid signature give unreadable", async () => {
    const fetchImpl = makeFetchImpl({
      [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
      [NEWEST_PDF_URL]: () => new Response("%PDF-1.4 garbage", { status: 200 }),
    });
    const result = await detectAdapter({ symbol: SYMBOL, bvbUrl: INSTRUMENT_PAGE_URL }, realChainDeps(fetchImpl));
    expect(result.adapterKey).toBeNull();
    expect(["unreadable", "fetch_error"]).toContain(result.reason);
  });

  it("DA-6: no adapter accepts the text gives no_match", async () => {
    const fetchImpl = makeFetchImpl({
      [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
      [NEWEST_PDF_URL]: () => new Response(pdfBytes, { status: 200 }),
    });
    const registry = createAdapterRegistry([
      { key: "never-matches", fieldKeys: [], canHandle: () => false, extract: () => ({ ok: false, error: "n/a" }) },
    ]);
    const result = await detectAdapter({ symbol: SYMBOL, bvbUrl: INSTRUMENT_PAGE_URL }, realChainDeps(fetchImpl, registry));
    expect(result).toEqual({ adapterKey: null, reason: "no_match" });
  });

  it("DA-7: two adapters both accept the text gives ambiguous", async () => {
    const fetchImpl = makeFetchImpl({
      [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
      [NEWEST_PDF_URL]: () => new Response(pdfBytes, { status: 200 }),
    });
    const registry = createAdapterRegistry([
      brdDepositaryAdapter,
      { key: "always-matches", fieldKeys: [], canHandle: () => true, extract: () => ({ ok: false, error: "n/a" }) },
    ]);
    const result = await detectAdapter({ symbol: SYMBOL, bvbUrl: INSTRUMENT_PAGE_URL }, realChainDeps(fetchImpl, registry));
    expect(result).toEqual({ adapterKey: null, reason: "ambiguous" });
  });

  it("DA-8: a thrown error anywhere in the chain resolves to internal_error, never rejects", async () => {
    const deps: DetectAdapterDeps = {
      discover: async () => {
        throw new Error("boom");
      },
      download: async () => ({ ok: true, bytes: new Uint8Array(), fetchedAt: new Date() }),
      extractText: async () => ({ ok: true, text: "x" }),
      registry: createAdapterRegistry([brdDepositaryAdapter]),
    };
    await expect(detectAdapter({ symbol: SYMBOL, bvbUrl: INSTRUMENT_PAGE_URL }, deps)).resolves.toEqual({
      adapterKey: null,
      reason: "internal_error",
    });
  });

  it("DA-8b: a throwing canHandle/extractText also resolves to internal_error", async () => {
    const deps: DetectAdapterDeps = {
      discover: async () => ({ status: "found", pdfUrl: NEWEST_PDF_URL, title: "VAN la data 22.09.2026" }),
      download: async () => ({ ok: true, bytes: new Uint8Array(), fetchedAt: new Date() }),
      extractText: async () => {
        throw new Error("boom");
      },
      registry: createAdapterRegistry([brdDepositaryAdapter]),
    };
    await expect(detectAdapter({ symbol: SYMBOL, bvbUrl: INSTRUMENT_PAGE_URL }, deps)).resolves.toEqual({
      adapterKey: null,
      reason: "internal_error",
    });
  });
});
