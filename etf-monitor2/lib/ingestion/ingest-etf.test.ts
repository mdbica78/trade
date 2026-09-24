import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import { createAdapterRegistry } from "../extraction/adapters/registry";
import type { ExtractionAdapter } from "../extraction/adapters/types";
import { discoverLatestReport } from "../extraction/discovery";
import { downloadReportPdf, extractPdfText } from "../extraction/pdf";
import type { ReportStore, SaveReportInput, SaveReportResult } from "./store";
import { ingestEtf, type IngestDeps, type IngestEtfInput } from "./ingest-etf";

const FIXTURES_DIR = path.join(__dirname, "..", "..", "test", "fixtures");
const BVB_DIR = path.join(FIXTURES_DIR, "bvb");

const INSTRUMENT_PAGE_URL = "https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=BTBETRETF";
const NEWEST_PDF_URL =
  "https://bvb.ro/infocont/infocont26/BTBETRETF_20260923092427_VUAN-BT-Index-Rom-nia-ETF-BET-TR-22-09-2026.pdf";

const instrumentHtml = readFileSync(path.join(BVB_DIR, "BTBETRETF-instrument-2026-09-23.html"), "utf8");
const pdfBytes = new Uint8Array(readFileSync(path.join(FIXTURES_DIR, "BTBETRETF-2026-09-22.pdf")));
const expectedFixtures = JSON.parse(readFileSync(path.join(FIXTURES_DIR, "expected.json"), "utf8")) as {
  fixtures: {
    file: string;
    values: Record<string, { rawValue: string; numericValue: string }>;
  }[];
};
const expectedValues = expectedFixtures.fixtures.find((f) => f.file === "BTBETRETF-2026-09-22.pdf")!.values;

const etf: IngestEtfInput = {
  id: 42,
  symbol: "BTBETRETF",
  bvbUrl: INSTRUMENT_PAGE_URL,
  adapterKey: "brd-depositary",
  trackedFieldKeys: ["units_in_circulation", "nav_per_unit"],
};

class FakeStore implements ReportStore {
  rows = new Map<string, { id: number; status: string; values: Map<string, { numericValue: string; rawValue: string }> }>();
  nextId = 1;
  findReportCalls: { etfId: number; reportDate: string }[] = [];
  saveReportCalls: SaveReportInput[] = [];
  findReportImpl?: (etfId: number, reportDate: string) => Promise<{ id: number; status: string } | undefined>;
  saveReportImpl?: (input: SaveReportInput) => Promise<SaveReportResult>;

  key(etfId: number, reportDate: string) {
    return `${etfId}:${reportDate}`;
  }

  async findReport(etfId: number, reportDate: string) {
    this.findReportCalls.push({ etfId, reportDate });
    if (this.findReportImpl) return this.findReportImpl(etfId, reportDate);
    const row = this.rows.get(this.key(etfId, reportDate));
    return row ? { id: row.id, status: row.status } : undefined;
  }

  async saveReport(input: SaveReportInput): Promise<SaveReportResult> {
    this.saveReportCalls.push(input);
    if (this.saveReportImpl) return this.saveReportImpl(input);
    const key = this.key(input.etfId, input.reportDate);
    const existing = this.rows.get(key);
    if (existing?.status === "ok") {
      return { status: "already_ok" };
    }
    const id = existing?.id ?? this.nextId++;
    const values = new Map(input.values.map((v) => [v.fieldKey, { numericValue: v.numericValue, rawValue: v.rawValue }]));
    this.rows.set(key, { id, status: input.status, values });
    return { status: "written", reportId: id };
  }
}

function makeFetchImpl(routes: Record<string, () => Response>): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const route = routes[url];
    if (!route) {
      return new Response("not found", { status: 404 });
    }
    return route();
  }) as unknown as typeof fetch;
}

function realDeps(fetchImpl: typeof fetch, store: ReportStore, registry: IngestDeps["registry"] = defaultAdapterRegistry): IngestDeps {
  return {
    discover: (e) => discoverLatestReport(e, { fetchImpl }),
    download: (url) => downloadReportPdf(url, { fetchImpl }),
    extractText: extractPdfText,
    registry,
    store,
  };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("real network forbidden");
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("AC1: happy path, offline", () => {
  it("IE-1: discovers, downloads, extracts, persists exactly the tracked fields", async () => {
    const fetchImpl = makeFetchImpl({
      [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
      [NEWEST_PDF_URL]: () => new Response(pdfBytes, { status: 200 }),
    });
    const store = new FakeStore();
    const outcome = await ingestEtf(etf, realDeps(fetchImpl, store));

    expect(store.saveReportCalls).toHaveLength(1);
    const save = store.saveReportCalls[0];
    expect(save.reportDate).toBe("2026-09-22");
    expect(save.sourceUrl).toBe(NEWEST_PDF_URL);
    expect(save.fetchedAt).toBeInstanceOf(Date);
    expect(save.status).toBe("ok");
    expect(save.errorMessage).toBeNull();
    expect(save.values).toHaveLength(2);
    for (const value of save.values) {
      expect(value.numericValue).toBe(expectedValues[value.fieldKey].numericValue);
      expect(value.rawValue).toBe(expectedValues[value.fieldKey].rawValue);
    }

    expect(outcome).toEqual({
      code: "ok",
      symbol: "BTBETRETF",
      reportDate: "2026-09-22",
      valuesWritten: 2,
      sourceUrl: NEWEST_PDF_URL,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const calledUrls = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calledUrls[0]).toBe(INSTRUMENT_PAGE_URL);
    expect(calledUrls[1]).toBe(NEWEST_PDF_URL);
  });
});

describe("AC2: report_date comes from the PDF footer only", () => {
  it("IE-2: a faked clock and a decoy publishedAt/filename don't change the stored reportDate", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2031-01-15T12:00:00Z"));

    const fetchImpl = makeFetchImpl({
      [NEWEST_PDF_URL]: () => new Response(pdfBytes, { status: 200 }),
    });
    const store = new FakeStore();
    const deps: IngestDeps = {
      discover: async () => ({
        status: "found",
        pdfUrl: NEWEST_PDF_URL,
        title: "VAN la data 01.01.2029",
        publishedAt: "2030-12-31T09:00",
      }),
      download: (url) => downloadReportPdf(url, { fetchImpl }),
      extractText: extractPdfText,
      registry: defaultAdapterRegistry,
      store,
    };

    const outcome = await ingestEtf(etf, deps);
    expect(outcome.code).toBe("ok");
    expect(store.saveReportCalls[0].reportDate).toBe("2026-09-22");
    expect(store.saveReportCalls[0].fetchedAt.toISOString()).toBe(new Date("2031-01-15T12:00:00Z").toISOString());
  });

  it("BD-3: no non-test file in lib/ingestion reads the clock or discovery's publishedAt", async () => {
    const { readdirSync, readFileSync: read } = await import("node:fs");
    const dir = __dirname;
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    for (const file of files) {
      const source = read(path.join(dir, file), "utf8");
      expect(source.includes("new Date(")).toBe(false);
      expect(source.includes("Date.now(")).toBe(false);
      expect(source.includes("publishedAt")).toBe(false);
    }
  });
});

describe("AC3: only tracked fields are persisted", () => {
  it("IE-3a: 8-field extraction with 2 tracked writes only those 2 keys", async () => {
    const fetchImpl = makeFetchImpl({
      [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
      [NEWEST_PDF_URL]: () => new Response(pdfBytes, { status: 200 }),
    });
    const store = new FakeStore();
    await ingestEtf(etf, realDeps(fetchImpl, store));
    expect(store.saveReportCalls[0].values.map((v) => v.fieldKey).sort()).toEqual(
      ["nav_per_unit", "units_in_circulation"].sort(),
    );
  });

  it("US-012 interim: incomplete extraction writes nothing (tracked key missing from result)", async () => {
    const fetchImpl = makeFetchImpl({
      [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
      [NEWEST_PDF_URL]: () => new Response(pdfBytes, { status: 200 }),
    });
    const store = new FakeStore();
    const etfUnknownTracked: IngestEtfInput = { ...etf, trackedFieldKeys: ["units_in_circulation", "not_a_real_field"] };
    const outcome = await ingestEtf(etfUnknownTracked, realDeps(fetchImpl, store));
    expect(outcome).toMatchObject({ code: "failed", stage: "select" });
    if (outcome.code === "failed") {
      expect(outcome.message).toContain("not_a_real_field");
    }
    expect(store.saveReportCalls).toHaveLength(0);
    expect(store.findReportCalls).toHaveLength(0);
  });

  it("IE-3c: zero tracked fields gives ok with valuesWritten 0", async () => {
    const fetchImpl = makeFetchImpl({
      [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
      [NEWEST_PDF_URL]: () => new Response(pdfBytes, { status: 200 }),
    });
    const store = new FakeStore();
    const etfNoTracked: IngestEtfInput = { ...etf, trackedFieldKeys: [] };
    const outcome = await ingestEtf(etfNoTracked, realDeps(fetchImpl, store));
    expect(outcome).toMatchObject({ code: "ok", valuesWritten: 0 });
    expect(store.saveReportCalls[0].values).toEqual([]);
  });

  it("BD-2: ingest-etf.ts imports ./select-values and does no field filtering itself", () => {
    const source = readFileSync(path.join(__dirname, "ingest-etf.ts"), "utf8");
    expect(source).toContain("./select-values");
  });
});

describe("AC4: persist interface has no separate write-values method", () => {
  it("IE-4: a rejected saveReport gives a failure outcome with stage 'persist', never throws", async () => {
    const fetchImpl = makeFetchImpl({
      [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
      [NEWEST_PDF_URL]: () => new Response(pdfBytes, { status: 200 }),
    });
    const store = new FakeStore();
    store.saveReportImpl = async () => {
      throw new Error("db exploded");
    };
    const outcome = await ingestEtf(etf, realDeps(fetchImpl, store));
    expect(outcome).toMatchObject({ code: "failed", stage: "persist", message: "db exploded" });
  });
});

describe("AC5: re-runs", () => {
  it("IE-5a: an existing ok row gives already_ingested and does not call saveReport", async () => {
    const fetchImpl = makeFetchImpl({
      [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
      [NEWEST_PDF_URL]: () => new Response(pdfBytes, { status: 200 }),
    });
    const store = new FakeStore();
    store.rows.set(store.key(etf.id, "2026-09-22"), { id: 1, status: "ok", values: new Map() });
    const outcome = await ingestEtf(etf, realDeps(fetchImpl, store));
    expect(outcome).toEqual({ code: "already_ingested", symbol: "BTBETRETF", reportDate: "2026-09-22" });
    expect(store.saveReportCalls).toHaveLength(0);
  });

  it("IE-5b: an existing non-ok row is replaced, saveReport called with status ok and new values", async () => {
    const fetchImpl = makeFetchImpl({
      [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
      [NEWEST_PDF_URL]: () => new Response(pdfBytes, { status: 200 }),
    });
    const store = new FakeStore();
    store.rows.set(store.key(etf.id, "2026-09-22"), { id: 1, status: "parse_error", values: new Map() });
    const outcome = await ingestEtf(etf, realDeps(fetchImpl, store));
    expect(outcome.code).toBe("ok");
    expect(store.saveReportCalls[0].status).toBe("ok");
  });

  it("IE-5c: running twice writes once; the second call still does one discovery and one download", async () => {
    const fetchImpl = makeFetchImpl({
      [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
      [NEWEST_PDF_URL]: () => new Response(pdfBytes, { status: 200 }),
    });
    const store = new FakeStore();
    const deps = realDeps(fetchImpl, store);
    const first = await ingestEtf(etf, deps);
    const second = await ingestEtf(etf, deps);
    expect(first.code).toBe("ok");
    expect(second.code).toBe("already_ingested");
    expect(store.saveReportCalls).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("IE-5d: a race where saveReport reports already_ok gives already_ingested", async () => {
    const fetchImpl = makeFetchImpl({
      [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
      [NEWEST_PDF_URL]: () => new Response(pdfBytes, { status: 200 }),
    });
    const store = new FakeStore();
    store.saveReportImpl = async () => ({ status: "already_ok" });
    const outcome = await ingestEtf(etf, realDeps(fetchImpl, store));
    expect(outcome).toEqual({ code: "already_ingested", symbol: "BTBETRETF", reportDate: "2026-09-22" });
  });
});

describe("AC6: one attempt, never throws", () => {
  it("IE-6b-i: a rejected fetch gives stage discovery, kind network", async () => {
    const store = new FakeStore();
    const failingFetch: typeof fetch = vi.fn(async () => {
      throw new Error("boom");
    }) as unknown as typeof fetch;
    const outcome = await ingestEtf(etf, realDeps(failingFetch, store));
    expect(outcome).toMatchObject({ code: "failed", stage: "discovery", kind: "network" });
  });

  it("IE-6b-ii: a throwing adapter extract() becomes a failed outcome with its message, not an exception", async () => {
    const fetchImpl = makeFetchImpl({
      [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
      [NEWEST_PDF_URL]: () => new Response(pdfBytes, { status: 200 }),
    });
    const throwingAdapter: ExtractionAdapter = {
      key: "brd-depositary",
      fieldKeys: ["units_in_circulation", "nav_per_unit"],
      canHandle: () => true,
      extract: () => {
        throw new Error("adapter blew up");
      },
    };
    const store = new FakeStore();
    const registry = createAdapterRegistry([throwingAdapter]);
    const outcome = await ingestEtf(etf, realDeps(fetchImpl, store, registry));
    expect(outcome).toMatchObject({ code: "failed", stage: "extract", message: "adapter blew up" });
  });

  it("IE-6b-iii: a rejected findReport/saveReport becomes stage persist, not an exception", async () => {
    const fetchImpl = makeFetchImpl({
      [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
      [NEWEST_PDF_URL]: () => new Response(pdfBytes, { status: 200 }),
    });
    const store = new FakeStore();
    store.findReportImpl = async () => {
      throw new Error("find failed");
    };
    const outcome = await ingestEtf(etf, realDeps(fetchImpl, store));
    expect(outcome).toMatchObject({ code: "failed", stage: "persist", message: "find failed" });
  });

  it("IE-6c: registry.get throwing gives stage adapter, not an exception", async () => {
    const store = new FakeStore();
    const registry = { get: () => { throw new Error("registry broken"); } };
    const outcome = await ingestEtf(etf, realDeps(vi.fn() as unknown as typeof fetch, store, registry));
    expect(outcome).toMatchObject({ code: "failed", stage: "adapter", message: "registry broken" });
  });

  it("a call with no adapter makes zero fetch calls", async () => {
    const fetchImpl = vi.fn();
    const store = new FakeStore();
    const outcome = await ingestEtf(
      { ...etf, adapterKey: "unknown-key" },
      realDeps(fetchImpl as unknown as typeof fetch, store),
    );
    expect(outcome).toMatchObject({ code: "failed", stage: "adapter" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("AC7: every failure path writes nothing and names its stage/message", () => {
  const cases: {
    name: string;
    setup: () => { fetchImpl: typeof fetch; registry?: IngestDeps["registry"]; etfOverride?: Partial<IngestEtfInput> };
    expect: { stage: string; kind?: string };
  }[] = [
    {
      name: "discovery error (503)",
      setup: () => ({
        fetchImpl: makeFetchImpl({ [INSTRUMENT_PAGE_URL]: () => new Response("oops", { status: 503 }) }),
      }),
      expect: { stage: "discovery", kind: "http_error" },
    },
    {
      name: "discovery not_found: list_not_found",
      setup: () => ({
        fetchImpl: makeFetchImpl({ [INSTRUMENT_PAGE_URL]: () => new Response("<html></html>", { status: 200 }) }),
      }),
      expect: { stage: "discovery", kind: "list_not_found" },
    },
    {
      name: "download failure: not_pdf",
      setup: () => ({
        fetchImpl: makeFetchImpl({
          [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
          [NEWEST_PDF_URL]: () => new Response("<html>not a pdf</html>", { status: 200 }),
        }),
      }),
      expect: { stage: "download", kind: "not_pdf" },
    },
    {
      name: "download failure: 404",
      setup: () => ({
        fetchImpl: makeFetchImpl({
          [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
        }),
      }),
      expect: { stage: "download", kind: "http_error" },
    },
    {
      name: "unreadable text",
      setup: () => ({
        fetchImpl: makeFetchImpl({
          [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
          [NEWEST_PDF_URL]: () => new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]), { status: 200 }),
        }),
      }),
      expect: { stage: "text", kind: "unreadable" },
    },
    {
      name: "no adapter: null key",
      setup: () => ({ fetchImpl: vi.fn() as unknown as typeof fetch, etfOverride: { adapterKey: null } }),
      expect: { stage: "adapter" },
    },
    {
      name: "no adapter: unknown key",
      setup: () => ({ fetchImpl: vi.fn() as unknown as typeof fetch, etfOverride: { adapterKey: "unknown-key" } }),
      expect: { stage: "adapter" },
    },
    {
      name: "adapter ok:false",
      setup: () => {
        const fetchImpl = makeFetchImpl({
          [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
          [NEWEST_PDF_URL]: () => new Response(pdfBytes, { status: 200 }),
        });
        const failingAdapter: ExtractionAdapter = {
          key: "brd-depositary",
          fieldKeys: ["units_in_circulation", "nav_per_unit"],
          canHandle: () => true,
          extract: () => ({ ok: false, error: "cannot parse" }),
        };
        return { fetchImpl, registry: createAdapterRegistry([failingAdapter]) };
      },
      expect: { stage: "extract" },
    },
    {
      name: "US-012 interim: validation violations write nothing",
      setup: () => {
        const fetchImpl = makeFetchImpl({
          [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
          [NEWEST_PDF_URL]: () => new Response(pdfBytes, { status: 200 }),
        });
        const badAdapter: ExtractionAdapter = {
          key: "brd-depositary",
          fieldKeys: ["units_in_circulation", "nav_per_unit"],
          canHandle: () => true,
          extract: () => ({
            ok: true,
            reportDate: "2026-09-22",
            values: [{ fieldKey: "unknown_field", numericValue: "1", rawValue: "1" }],
            missingFields: ["units_in_circulation", "nav_per_unit"],
          }),
        };
        return { fetchImpl, registry: createAdapterRegistry([badAdapter]) };
      },
      expect: { stage: "validate" },
    },
  ];

  for (const testCase of cases) {
    it(`${testCase.name}`, async () => {
      const { fetchImpl, registry, etfOverride } = testCase.setup();
      const store = new FakeStore();
      const testEtf = { ...etf, ...etfOverride };
      const outcome = await ingestEtf(testEtf, realDeps(fetchImpl, store, registry ?? defaultAdapterRegistry));
      expect(outcome.code).toBe("failed");
      if (outcome.code === "failed") {
        expect(outcome.stage).toBe(testCase.expect.stage);
        if (testCase.expect.kind) {
          expect(outcome.kind).toBe(testCase.expect.kind);
        }
        expect(outcome.message.length).toBeGreaterThan(0);
      }
      expect(store.saveReportCalls).toHaveLength(0);
      expect(store.findReportCalls).toHaveLength(0);
    });
  }
});
