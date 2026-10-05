import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import { discoverLatestReport } from "../extraction/discovery";
import { downloadReportPdf, extractPdfText } from "../extraction/pdf";
import { FakeLinkStore, FakeStore, FIXED_NOW, foundDiscovery, INSTRUMENT_PAGE_URL, linkDeps, makeFetchImpl, NEWEST_PDF_URL } from "../../test/helpers/ingest-fakes";
import { ingestEtf, type IngestDeps, type IngestEtfInput } from "./ingest-etf";
import { formatRunLog, summarizeRun } from "./job-run-summary";

const FIXTURES_DIR = path.join(__dirname, "..", "..", "test", "fixtures");
const BVB_DIR = path.join(FIXTURES_DIR, "bvb");
const instrumentHtml = readFileSync(path.join(BVB_DIR, "BTBETRETF-instrument-2026-09-23.html"), "utf8");
const pdfBytes = new Uint8Array(readFileSync(path.join(FIXTURES_DIR, "BTBETRETF-2026-09-22.pdf")));

const etf: IngestEtfInput = {
  id: 42,
  symbol: "BTBETRETF",
  bvbUrl: "https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=BTBETRETF",
  adapterKey: null,
  trackedFieldKeys: [],
};

function deps(overrides: Partial<IngestDeps> = {}): { deps: IngestDeps; store: FakeStore; links: FakeLinkStore } {
  const store = new FakeStore();
  const links = new FakeLinkStore();
  return {
    store,
    links,
    deps: {
      discover: vi.fn(),
      download: vi.fn(),
      extractText: vi.fn(),
      registry: defaultAdapterRegistry,
      store,
      links,
      now: () => FIXED_NOW,
      ...overrides,
    },
  };
}

describe.each([
  { name: "null adapter_key", adapterKey: null },
  { name: "unregistered adapter_key", adapterKey: "unknown-key" },
])("ingestEtf's no-adapter branch ($name)", ({ adapterKey }) => {
  it("NA-1: found stores the link and reports it in the detail", async () => {
    const { deps: d, store, links } = deps({
      discover: vi.fn(async () => foundDiscovery({ pdfUrl: NEWEST_PDF_URL, title: "VAN la data 22.09.2026" })),
    });
    const outcome = await ingestEtf({ ...etf, adapterKey }, d);
    expect(outcome.code).toBe("no_adapter");
    expect(d.discover).toHaveBeenCalledTimes(1);
    expect(d.download).not.toHaveBeenCalled();
    expect(store.saveReportCalls).toHaveLength(0);
    expect(links.calls).toEqual([{ etfId: 42, sourceUrl: NEWEST_PDF_URL, discoveredAt: FIXED_NOW }]);
    expect(outcome.detail).toContain("report link stored");
  });

  it("NA-2: not_found and error leave no link written, with the reason in the detail", async () => {
    const notFound = deps({ discover: vi.fn(async () => ({ status: "not_found" as const, reason: "list_not_found" as const })) });
    const notFoundOutcome = await ingestEtf({ ...etf, adapterKey }, notFound.deps);
    expect(notFoundOutcome.code).toBe("no_adapter");
    expect(notFound.links.calls).toHaveLength(0);
    expect(notFoundOutcome.detail).toContain("not_found: list_not_found");

    const errored = deps({ discover: vi.fn(async () => ({ status: "error" as const, kind: "http_error" as const, message: "boom", httpStatus: 503 })) });
    const erroredOutcome = await ingestEtf({ ...etf, adapterKey }, errored.deps);
    expect(erroredOutcome.code).toBe("no_adapter");
    expect(errored.links.calls).toHaveLength(0);
    expect(erroredOutcome.detail).toContain("discovery http_error 503");
  });

  it("NA-3: no reportDate on the outcome", async () => {
    const { deps: d } = deps({ discover: vi.fn(async () => ({ status: "not_found" as const, reason: "list_not_found" as const })) });
    const outcome = await ingestEtf({ ...etf, adapterKey }, d);
    expect("reportDate" in outcome).toBe(false);
  });

  it("NA-4: a throwing discover, or a rejecting links.upsert, still resolves to no_adapter with a one-line detail", async () => {
    const throwingDiscover = deps({
      discover: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    await expect(ingestEtf({ ...etf, adapterKey }, throwingDiscover.deps)).resolves.toMatchObject({ code: "no_adapter" });

    const rejectingLinks = deps({
      discover: vi.fn(async () => foundDiscovery({ pdfUrl: NEWEST_PDF_URL, title: "VAN la data 22.09.2026" })),
    });
    rejectingLinks.links.impl = async () => {
      throw new Error("db down");
    };
    const outcome = await ingestEtf({ ...etf, adapterKey }, rejectingLinks.deps);
    expect(outcome.code).toBe("no_adapter");
    expect(outcome.detail).not.toContain("\n");
  });

  it("NA-7: the detail never contains a link-write error's message", async () => {
    const { deps: d } = deps({
      discover: vi.fn(async () => foundDiscovery({ pdfUrl: NEWEST_PDF_URL, title: "x" })),
    });
    (d.links as FakeLinkStore).impl = async () => {
      throw new Error("SENTINEL_DB_ERROR_TEXT");
    };
    const outcome = await ingestEtf({ ...etf, adapterKey }, d);
    expect(JSON.stringify(outcome)).not.toContain("SENTINEL_DB_ERROR_TEXT");
    const summary = summarizeRun([{ symbol: etf.symbol, outcome }]);
    const log = formatRunLog([{ symbol: etf.symbol, outcome }], summary, []);
    expect(log).not.toContain("SENTINEL_DB_ERROR_TEXT");
  });
});

describe("NA-5: isolation — a no-adapter ETF followed by a normal one", () => {
  it("the no-adapter ETF makes exactly 1 request and no store call; the next ETF still ingests normally (3 fetch calls total, 1 saveReport)", async () => {
    const fetchImpl = makeFetchImpl({
      [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
      [NEWEST_PDF_URL]: () => new Response(pdfBytes, { status: 200 }),
    });
    const store = new FakeStore();
    const deps: IngestDeps = {
      discover: (e) => discoverLatestReport(e, { fetchImpl }),
      download: (url) => downloadReportPdf(url, { fetchImpl }),
      extractText: extractPdfText,
      registry: defaultAdapterRegistry,
      store,
      ...linkDeps(),
    };

    const first = await ingestEtf({ ...etf, adapterKey: null }, deps);
    expect(first.code).toBe("no_adapter");
    expect(store.saveReportCalls).toHaveLength(0);

    const okEtf: IngestEtfInput = {
      ...etf,
      id: 43,
      adapterKey: "brd-depositary",
      trackedFieldKeys: ["net_asset", "units_in_circulation", "nav_per_unit"],
    };
    const second = await ingestEtf(okEtf, deps);
    expect(second.code).toBe("ok");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(store.saveReportCalls).toHaveLength(1);
  });
});
