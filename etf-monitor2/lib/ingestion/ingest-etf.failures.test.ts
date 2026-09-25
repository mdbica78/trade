import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import type { AdapterRegistry, ExtractionAdapter } from "../extraction/adapters/types";
import { discoverLatestReport } from "../extraction/discovery";
import { downloadReportPdf, extractPdfText } from "../extraction/pdf";
import {
  allSaveReportInputs,
  FakeStore,
  INSTRUMENT_PAGE_URL,
  makeFetchImpl,
  NEWEST_PDF_URL,
  stubPipelineDeps,
} from "../../test/helpers/ingest-fakes";
import { INGEST_OUTCOME_CODES, type IngestOutcome, type IngestOutcomeCode } from "./outcome";
import { ingestEtf, type IngestDeps, type IngestEtfInput } from "./ingest-etf";
import type { SaveReportInput } from "./store";

const FIXTURES_DIR = path.join(__dirname, "..", "..", "test", "fixtures");
const BVB_DIR = path.join(FIXTURES_DIR, "bvb");
const instrumentHtml = readFileSync(path.join(BVB_DIR, "BTBETRETF-instrument-2026-09-23.html"), "utf8");
const pdfBytes = new Uint8Array(readFileSync(path.join(FIXTURES_DIR, "BTBETRETF-2026-09-22.pdf")));

const etf: IngestEtfInput = {
  id: 42,
  symbol: "BTBETRETF",
  bvbUrl: INSTRUMENT_PAGE_URL,
  adapterKey: "brd-depositary",
  trackedFieldKeys: ["net_asset", "units_in_circulation", "nav_per_unit"],
};

const fakeAdapter: ExtractionAdapter = {
  key: "fake-depositary",
  fieldKeys: ["net_asset", "units_in_circulation", "nav_per_unit"],
  canHandle: () => true,
  extract: () => ({
    ok: true,
    reportDate: "2026-09-22",
    values: [
      { fieldKey: "net_asset", numericValue: "1000", rawValue: "1000" },
      { fieldKey: "units_in_circulation", numericValue: "10", rawValue: "10" },
      { fieldKey: "nav_per_unit", numericValue: "100", rawValue: "100" },
    ],
    missingFields: [],
  }),
};

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
});

describe("AC1: no adapter", () => {
  it("IF-1a: adapterKey null gives no_adapter, zero fetch/store calls", async () => {
    const fetchImpl = vi.fn();
    const store = new FakeStore();
    const outcome = await ingestEtf(
      { ...etf, adapterKey: null },
      { discover: vi.fn(), download: vi.fn(), extractText: vi.fn(), registry: defaultAdapterRegistry, store },
    );
    expect(outcome).toMatchObject({ code: "no_adapter", detail: "no adapter: adapter_key not set" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(store.findReportCalls).toHaveLength(0);
    expect(store.saveReportCalls).toHaveLength(0);
  });

  it("IF-1b: an unregistered adapterKey gives no_adapter with the key in the detail", async () => {
    const store = new FakeStore();
    const outcome = await ingestEtf(
      { ...etf, adapterKey: "unknown-key" },
      { discover: vi.fn(), download: vi.fn(), extractText: vi.fn(), registry: defaultAdapterRegistry, store },
    );
    expect(outcome).toMatchObject({ code: "no_adapter", detail: 'no adapter: adapter_key "unknown-key" is not registered' });
    expect(store.findReportCalls).toHaveLength(0);
    expect(store.saveReportCalls).toHaveLength(0);
  });

  it("IF-1c: a no-adapter ETF is isolated - a following ETF still ingests normally", async () => {
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
    };

    const first = await ingestEtf({ ...etf, adapterKey: null }, deps);
    expect(first.code).toBe("no_adapter");
    const second = await ingestEtf(etf, deps);
    expect(second.code).toBe("ok");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(store.saveReportCalls).toHaveLength(1);
  });

  it("IF-1d: a no_adapter outcome carries no reportDate", async () => {
    const store = new FakeStore();
    const outcome = await ingestEtf(
      { ...etf, adapterKey: null },
      { discover: vi.fn(), download: vi.fn(), extractText: vi.fn(), registry: defaultAdapterRegistry, store },
    );
    expect("reportDate" in outcome).toBe(false);
  });
});

describe("AC2: missing report", () => {
  it("IF-2a: no gv5News table gives missing/list_not_found, one fetch, no download", async () => {
    const fetchImpl = makeFetchImpl({ [INSTRUMENT_PAGE_URL]: () => new Response("<html></html>", { status: 200 }) });
    const store = new FakeStore();
    const deps: IngestDeps = {
      discover: (e) => discoverLatestReport(e, { fetchImpl }),
      download: vi.fn(),
      extractText: vi.fn(),
      registry: defaultAdapterRegistry,
      store,
    };
    const outcome = await ingestEtf(etf, deps);
    expect(outcome).toMatchObject({ code: "missing", reason: "list_not_found", detail: "no report found: list_not_found" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(store.findReportCalls).toHaveLength(0);
    expect(store.saveReportCalls).toHaveLength(0);
    expect("reportDate" in outcome).toBe(false);
  });

  it("IF-2b: a gv5News table with no VAN la data row gives missing/no_report_entries", async () => {
    const html = `<table id="gv5News"><tr><td><input type="text" value="some other filing" /><p class="date">01.01.2026 10:00:00</p></td></tr></table>`;
    const fetchImpl = makeFetchImpl({ [INSTRUMENT_PAGE_URL]: () => new Response(html, { status: 200 }) });
    const store = new FakeStore();
    const deps: IngestDeps = {
      discover: (e) => discoverLatestReport(e, { fetchImpl }),
      download: vi.fn(),
      extractText: vi.fn(),
      registry: defaultAdapterRegistry,
      store,
    };
    const outcome = await ingestEtf(etf, deps);
    expect(outcome).toMatchObject({ code: "missing", reason: "no_report_entries", detail: "no report found: no_report_entries" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(store.findReportCalls).toHaveLength(0);
    expect(store.saveReportCalls).toHaveLength(0);
  });
});

describe("AC3: fetch failures", () => {
  const cases: {
    name: string;
    setup: () => { fetchImpl: typeof fetch };
    expect: { stage: string; kind: string; detailPrefix: string };
    expectedCalls: number;
  }[] = [
    {
      name: "discovery http_error",
      setup: () => ({ fetchImpl: makeFetchImpl({ [INSTRUMENT_PAGE_URL]: () => new Response("oops", { status: 503 }) }) }),
      expect: { stage: "discovery", kind: "http_error", detailPrefix: "discovery http_error 503:" },
      expectedCalls: 1,
    },
    {
      name: "discovery network",
      setup: () => ({
        fetchImpl: vi.fn(async () => {
          throw new Error("dns fail");
        }) as unknown as typeof fetch,
      }),
      expect: { stage: "discovery", kind: "network", detailPrefix: "discovery network:" },
      expectedCalls: 1,
    },
    {
      name: "download http_error",
      setup: () => {
        return {
          fetchImpl: makeFetchImpl({
            [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
            [NEWEST_PDF_URL]: () => new Response("nope", { status: 404 }),
          }),
        };
      },
      expect: { stage: "download", kind: "http_error", detailPrefix: "download http_error 404:" },
      expectedCalls: 2,
    },
    {
      name: "download network",
      setup: () => {
        const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
          const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
          if (url === INSTRUMENT_PAGE_URL) return new Response(instrumentHtml, { status: 200 });
          throw new Error("connection reset");
        }) as unknown as typeof fetch;
        return { fetchImpl };
      },
      expect: { stage: "download", kind: "network", detailPrefix: "download network:" },
      expectedCalls: 2,
    },
    {
      name: "download not_pdf",
      setup: () => {
        return {
          fetchImpl: makeFetchImpl({
            [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
            [NEWEST_PDF_URL]: () => new Response("<html>not a pdf</html>", { status: 200 }),
          }),
        };
      },
      expect: { stage: "download", kind: "not_pdf", detailPrefix: "download not_pdf:" },
      expectedCalls: 2,
    },
  ];

  for (const testCase of cases) {
    it(`IF-3: ${testCase.name}`, async () => {
      const { fetchImpl } = testCase.setup();
      const store = new FakeStore();
      const deps: IngestDeps = {
        discover: (e) => discoverLatestReport(e, { fetchImpl }),
        download: (url) => downloadReportPdf(url, { fetchImpl }),
        extractText: vi.fn(),
        registry: defaultAdapterRegistry,
        store,
      };
      const outcome = await ingestEtf(etf, deps);
      expect(outcome).toMatchObject({ code: "fetch_error", stage: testCase.expect.stage, kind: testCase.expect.kind });
      if (outcome.code === "fetch_error") {
        expect(outcome.detail.startsWith(testCase.expect.detailPrefix)).toBe(true);
      }
      expect(fetchImpl).toHaveBeenCalledTimes(testCase.expectedCalls);
      expect(store.findReportCalls).toHaveLength(0);
      expect(store.saveReportCalls).toHaveLength(0);
      expect("reportDate" in outcome).toBe(false);
    });
  }

  it("IF-3: discovery timeout", async () => {
    const store = new FakeStore();
    const neverResolving = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    const deps: IngestDeps = {
      discover: (e) => discoverLatestReport(e, { fetchImpl: neverResolving, timeoutMs: 20 }),
      download: vi.fn(),
      extractText: vi.fn(),
      registry: defaultAdapterRegistry,
      store,
    };
    const outcome = await ingestEtf(etf, deps);
    expect(outcome).toMatchObject({ code: "fetch_error", stage: "discovery", kind: "timeout" });
    expect(neverResolving).toHaveBeenCalledTimes(1);
  });

  it("IF-3: download timeout", async () => {
    const store = new FakeStore();
    let calls = 0;
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      calls += 1;
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === INSTRUMENT_PAGE_URL) return Promise.resolve(new Response(instrumentHtml, { status: 200 }));
      return new Promise<Response>(() => {});
    }) as unknown as typeof fetch;
    const deps: IngestDeps = {
      discover: (e) => discoverLatestReport(e, { fetchImpl }),
      download: (url) => downloadReportPdf(url, { fetchImpl, timeoutMs: 20 }),
      extractText: vi.fn(),
      registry: defaultAdapterRegistry,
      store,
    };
    const outcome = await ingestEtf(etf, deps);
    expect(outcome).toMatchObject({ code: "fetch_error", stage: "download", kind: "timeout" });
    expect(calls).toBe(2);
  });
});

describe("AC4: unusable report", () => {
  it("IF-4a: an unreadable PDF gives parse_error/unreadable_text (real path)", async () => {
    const garbage = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]);
    const fetchImpl = makeFetchImpl({
      [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
      [NEWEST_PDF_URL]: () => new Response(garbage, { status: 200 }),
    });
    const store = new FakeStore();
    const deps: IngestDeps = {
      discover: (e) => discoverLatestReport(e, { fetchImpl }),
      download: (url) => downloadReportPdf(url, { fetchImpl }),
      extractText: extractPdfText,
      registry: defaultAdapterRegistry,
      store,
    };
    const outcome = await ingestEtf(etf, deps);
    expect(outcome).toMatchObject({ code: "parse_error", reason: "unreadable_text" });
    if (outcome.code === "parse_error") {
      expect(outcome.detail.startsWith("unreadable text:")).toBe(true);
    }
    expect(store.saveReportCalls).toHaveLength(0);
    expect(store.findReportCalls).toHaveLength(0);
  });

  it("IF-4b: extractText returning ok:false gives parse_error/unreadable_text (stub)", async () => {
    const store = new FakeStore();
    const deps = stubPipelineDeps(fakeAdapter, "", store, {
      extractText: async () => ({ ok: false, kind: "unreadable", message: "PDF has no extractable text" }),
    });
    const outcome = await ingestEtf(etf, deps);
    expect(outcome).toMatchObject({ code: "parse_error", reason: "unreadable_text" });
    expect(store.saveReportCalls).toHaveLength(0);
    expect(store.findReportCalls).toHaveLength(0);
  });

  it("IF-4c: canHandle false stops extraction (fake adapter)", async () => {
    const extract = vi.fn(() => ({ ok: true as const, reportDate: "2026-09-22", values: [], missingFields: [] }));
    const noHandleAdapter: ExtractionAdapter = { ...fakeAdapter, canHandle: () => false, extract };
    const store = new FakeStore();
    const deps = stubPipelineDeps(noHandleAdapter, "irrelevant text", store);
    const outcome = await ingestEtf(etf, deps);
    expect(outcome).toMatchObject({
      code: "parse_error",
      reason: "format_not_recognised",
      detail: "report format not recognised by adapter fake-depositary",
    });
    expect(extract).not.toHaveBeenCalled();
    expect(store.findReportCalls).toHaveLength(0);
    expect(store.saveReportCalls).toHaveLength(0);
  });

  it("IF-4d: canHandle false with the real brd-depositary adapter", async () => {
    const store = new FakeStore();
    const deps = stubPipelineDeps(
      defaultAdapterRegistry.get("brd-depositary")!,
      "Raport lunar al altui depozitar",
      store,
    );
    const outcome = await ingestEtf(etf, deps);
    expect(outcome).toMatchObject({ code: "parse_error", reason: "format_not_recognised" });
  });

  it("IF-4e: adapter ok:false gives parse_error/extraction_failed", async () => {
    const failingAdapter: ExtractionAdapter = {
      ...fakeAdapter,
      extract: () => ({ ok: false, error: "report date not found (footer phrase missing)" }),
    };
    const store = new FakeStore();
    const deps = stubPipelineDeps(failingAdapter, "text", store);
    const outcome = await ingestEtf(etf, deps);
    expect(outcome).toMatchObject({
      code: "parse_error",
      reason: "extraction_failed",
      detail: "extraction failed: report date not found (footer phrase missing)",
    });
    expect(store.saveReportCalls).toHaveLength(0);
    expect(store.findReportCalls).toHaveLength(0);
  });

  it("IF-4f: registry is used only via get, never detect", () => {
    expectTypeOf<IngestDeps["registry"]>().toEqualTypeOf<Pick<AdapterRegistry, "get">>();
  });
});

describe("AC5: incomplete extraction", () => {
  function adapterWithMissing(missing: readonly string[]): ExtractionAdapter {
    return {
      key: "fake-depositary",
      fieldKeys: ["net_asset", "units_in_circulation", "nav_per_unit"],
      canHandle: () => true,
      extract: () => ({
        ok: true,
        reportDate: "2026-09-22",
        values: [
          { fieldKey: "net_asset", numericValue: "1000", rawValue: "1000" },
          { fieldKey: "units_in_circulation", numericValue: "10", rawValue: "10" },
        ].filter((v) => !missing.includes(v.fieldKey)),
        missingFields: missing,
      }),
    };
  }

  it("IF-5a: a missing tracked field writes a parse_error row with the found values", async () => {
    const store = new FakeStore();
    const adapter = adapterWithMissing(["nav_per_unit"]);
    const deps = stubPipelineDeps(adapter, "text", store);
    const outcome = await ingestEtf(etf, deps);

    expect(store.saveReportCalls).toHaveLength(1);
    const save = store.saveReportCalls[0];
    expect(save.status).toBe("parse_error");
    expect(save.reportDate).toBe("2026-09-22");
    expect(save.sourceUrl).toBe(NEWEST_PDF_URL);
    expect(save.fetchedAt).toBeInstanceOf(Date);
    expect(save.errorMessage).toBe("missing fields: nav_per_unit");
    expect(save.values.map((v) => v.fieldKey).sort()).toEqual(["net_asset", "units_in_circulation"]);

    expect(outcome).toMatchObject({ code: "parse_error", reason: "incomplete", reportDate: "2026-09-22", detail: "missing fields: nav_per_unit" });
  });

  it("IF-5b: tracked order determines the message order for multiple missing keys", async () => {
    const adapter: ExtractionAdapter = {
      key: "fake-depositary",
      fieldKeys: ["net_asset", "nav_per_unit"],
      canHandle: () => true,
      extract: () => ({
        ok: true,
        reportDate: "2026-09-22",
        values: [{ fieldKey: "net_asset", numericValue: "1000", rawValue: "1000" }],
        missingFields: ["nav_per_unit"],
      }),
    };
    const store = new FakeStore();
    const trackedEtf: IngestEtfInput = { ...etf, trackedFieldKeys: ["net_asset", "nav_per_unit", "not_a_real_field"] };
    const deps = stubPipelineDeps(adapter, "text", store);
    await ingestEtf(trackedEtf, deps);
    expect(store.saveReportCalls[0].errorMessage).toBe("missing fields: nav_per_unit, not_a_real_field");
  });

  it("IF-5c: every tracked field missing writes a parse_error row with zero values", async () => {
    const adapter = adapterWithMissing(["net_asset", "units_in_circulation", "nav_per_unit"]);
    const store = new FakeStore();
    const deps = stubPipelineDeps(adapter, "text", store);
    await ingestEtf(etf, deps);
    expect(store.saveReportCalls[0].values).toEqual([]);
    expect(store.saveReportCalls[0].status).toBe("parse_error");
  });

  it("IF-5d: no IF-5 saveReport call ever has status ok", () => {
    const okCalls = allSaveReportInputs.filter((c) => c.status === "ok" && c.errorMessage === "missing fields: nav_per_unit");
    expect(okCalls).toHaveLength(0);
  });
});

describe("AC6: contract violations", () => {
  it("IF-6a: violations with a valid date write a parse_error row with no values", async () => {
    const badAdapter: ExtractionAdapter = {
      key: "fake-depositary",
      fieldKeys: ["net_asset", "units_in_circulation", "nav_per_unit"],
      canHandle: () => true,
      extract: () => ({
        ok: true,
        reportDate: "2026-09-22",
        values: [
          { fieldKey: "net_asset", numericValue: "1,234.5", rawValue: "1,234.5" },
          { fieldKey: "units_in_circulation", numericValue: "10", rawValue: "10" },
        ],
        missingFields: [],
      }),
    };
    const store = new FakeStore();
    const deps = stubPipelineDeps(badAdapter, "text", store);
    const outcome = await ingestEtf(etf, deps);

    expect(store.saveReportCalls).toHaveLength(1);
    const save = store.saveReportCalls[0];
    expect(save.status).toBe("parse_error");
    expect(save.values).toEqual([]);
    expect(save.errorMessage).toBe("contract violations: uncovered_field(nav_per_unit); invalid_numeric_value(net_asset)");
    expect(outcome).toMatchObject({ code: "parse_error", reason: "contract_violation", reportDate: "2026-09-22" });
  });

  it("IF-6b: the message never contains extracted text, only rule/fieldKey", async () => {
    const badAdapter: ExtractionAdapter = {
      key: "fake-depositary",
      fieldKeys: ["net_asset", "units_in_circulation", "nav_per_unit"],
      canHandle: () => true,
      extract: () => ({
        ok: true,
        reportDate: "2026-09-22",
        values: [
          { fieldKey: "net_asset", numericValue: "1,234.5", rawValue: "1,234.5" },
          { fieldKey: "units_in_circulation", numericValue: "10", rawValue: "10" },
        ],
        missingFields: [],
      }),
    };
    const store = new FakeStore();
    const deps = stubPipelineDeps(badAdapter, "text", store);
    const outcome = await ingestEtf(etf, deps);
    const detail = outcome.code === "parse_error" ? outcome.detail : "";
    expect(detail).not.toContain("1,234.5");
    expect(store.saveReportCalls[0].errorMessage).not.toContain("1,234.5");
  });

  it("IF-6c: an invalid report date writes no row", async () => {
    const badAdapter: ExtractionAdapter = {
      key: "fake-depositary",
      fieldKeys: ["net_asset", "units_in_circulation", "nav_per_unit"],
      canHandle: () => true,
      extract: () => ({
        ok: true,
        reportDate: "2026-02-30",
        values: [
          { fieldKey: "net_asset", numericValue: "1000", rawValue: "1000" },
          { fieldKey: "units_in_circulation", numericValue: "10", rawValue: "10" },
          { fieldKey: "nav_per_unit", numericValue: "100", rawValue: "100" },
        ],
        missingFields: [],
      }),
    };
    const store = new FakeStore();
    const deps = stubPipelineDeps(badAdapter, "text", store);
    const outcome = await ingestEtf(etf, deps);
    expect(store.findReportCalls).toHaveLength(0);
    expect(store.saveReportCalls).toHaveLength(0);
    expect(outcome).toMatchObject({ code: "parse_error", reason: "contract_violation", detail: "contract violations: invalid_report_date" });
    expect("reportDate" in outcome).toBe(false);
  });

  it("IF-6d: violations win over incompleteness", async () => {
    const badAdapter: ExtractionAdapter = {
      key: "fake-depositary",
      fieldKeys: ["net_asset", "units_in_circulation", "nav_per_unit"],
      canHandle: () => true,
      extract: () => ({
        ok: true,
        reportDate: "2026-09-22",
        values: [{ fieldKey: "net_asset", numericValue: "1,234.5", rawValue: "1,234.5" }],
        missingFields: ["units_in_circulation", "nav_per_unit"],
      }),
    };
    const store = new FakeStore();
    const deps = stubPipelineDeps(badAdapter, "text", store);
    await ingestEtf(etf, deps);
    expect(store.saveReportCalls[0].values).toEqual([]);
    expect(store.saveReportCalls[0].errorMessage?.startsWith("contract violations:")).toBe(true);
  });
});

describe("AC7: precedence", () => {
  it("IF-7a: an existing ok row gives already_ingested, saveReport never called", async () => {
    const store = new FakeStore();
    store.seed(etf.id, "2026-09-22", "ok");
    const deps = stubPipelineDeps(fakeAdapter, "text", store);
    const outcome = await ingestEtf(etf, deps);
    expect(outcome).toMatchObject({ code: "already_ingested", reportDate: "2026-09-22", detail: "report already stored" });
    expect(store.findReportCalls).toHaveLength(1);
    expect(store.saveReportCalls).toHaveLength(0);
  });

  it("IF-7b: a race where saveReport reports already_ok gives already_ingested", async () => {
    const store = new FakeStore();
    store.saveReportImpl = async () => ({ status: "already_ok" });
    const deps = stubPipelineDeps(fakeAdapter, "text", store);
    const outcome = await ingestEtf(etf, deps);
    expect(outcome).toMatchObject({ code: "already_ingested" });
  });

  it("IF-7c: an existing parse_error row is replaced by a later complete result", async () => {
    const store = new FakeStore();
    store.seed(etf.id, "2026-09-22", "parse_error", [{ fieldKey: "net_asset", numericValue: "1", rawValue: "1" }], "old");
    const deps = stubPipelineDeps(fakeAdapter, "text", store);
    const outcome = await ingestEtf(etf, deps);
    expect(outcome.code).toBe("ok");
    expect(store.saveReportCalls[0].status).toBe("ok");
    expect(store.saveReportCalls[0].errorMessage).toBeNull();
  });

  it("IF-7d: an existing parse_error row is replaced by a later parse_error result", async () => {
    const store = new FakeStore();
    store.seed(etf.id, "2026-09-22", "parse_error", [{ fieldKey: "units_in_circulation", numericValue: "1", rawValue: "1" }], "missing fields: net_asset");
    const adapter = adapterMissingNav();
    const deps = stubPipelineDeps(adapter, "text", store);
    await ingestEtf(etf, deps);
    expect(store.saveReportCalls[0].status).toBe("parse_error");
    expect(store.saveReportCalls[0].errorMessage).toBe("missing fields: nav_per_unit");
    expect(store.saveReportCalls[0].values.map((v) => v.fieldKey).sort()).toEqual(["net_asset", "units_in_circulation"]);
  });
});

function adapterMissingNav(): ExtractionAdapter {
  return {
    key: "fake-depositary",
    fieldKeys: ["net_asset", "units_in_circulation", "nav_per_unit"],
    canHandle: () => true,
    extract: () => ({
      ok: true,
      reportDate: "2026-09-22",
      values: [
        { fieldKey: "net_asset", numericValue: "1000", rawValue: "1000" },
        { fieldKey: "units_in_circulation", numericValue: "10", rawValue: "10" },
      ],
      missingFields: ["nav_per_unit"],
    }),
  };
}

describe("AC8: one outcome from the closed vocabulary, never throws", () => {
  it("IF-8a: a trigger per code produces exactly that code with a non-empty single-line detail", async () => {
    const triggers: Record<IngestOutcomeCode, () => Promise<IngestOutcome>> = {
      ok: () => ingestEtf(etf, stubPipelineDeps(fakeAdapter, "text", new FakeStore())),
      already_ingested: () => {
        const s = new FakeStore();
        s.seed(etf.id, "2026-09-22", "ok");
        return ingestEtf(etf, stubPipelineDeps(fakeAdapter, "text", s));
      },
      missing: () =>
        ingestEtf(etf, {
          discover: async () => ({ status: "not_found", reason: "list_not_found" }),
          download: vi.fn(),
          extractText: vi.fn(),
          registry: { get: () => fakeAdapter },
          store: new FakeStore(),
        }),
      fetch_error: () =>
        ingestEtf(etf, {
          discover: async () => ({ status: "error", kind: "network", message: "boom" }),
          download: vi.fn(),
          extractText: vi.fn(),
          registry: { get: () => fakeAdapter },
          store: new FakeStore(),
        }),
      no_adapter: () =>
        ingestEtf(
          { ...etf, adapterKey: null },
          { ...stubPipelineDeps(fakeAdapter, "text", new FakeStore()), registry: { get: () => undefined } },
        ),
      parse_error: () =>
        ingestEtf(etf, stubPipelineDeps(fakeAdapter, "text", new FakeStore(), { extractText: async () => ({ ok: false, kind: "unreadable", message: "bad" }) })),
      persist_error: () => {
        const s = new FakeStore();
        s.saveReportImpl = async () => {
          throw new Error("db down");
        };
        return ingestEtf(etf, stubPipelineDeps(fakeAdapter, "text", s));
      },
    };

    const producedCodes = new Set<string>();
    for (const code of INGEST_OUTCOME_CODES) {
      const outcome = await triggers[code]();
      expect(outcome.code).toBe(code);
      expect(typeof outcome.symbol).toBe("string");
      expect(outcome.detail.length).toBeGreaterThan(0);
      expect(outcome.detail).not.toContain("\n");
      producedCodes.add(outcome.code);
    }
    expect([...producedCodes].sort()).toEqual([...INGEST_OUTCOME_CODES].sort());
  });

  const throwers: { name: string; expectCode: IngestOutcomeCode; expectExtra?: Record<string, unknown>; build: (fail: () => never) => IngestDeps }[] = [
    {
      name: "registry.get throws",
      expectCode: "no_adapter",
      build: (fail) => ({ discover: vi.fn(), download: vi.fn(), extractText: vi.fn(), registry: { get: fail }, store: new FakeStore() }),
    },
    {
      name: "discover throws",
      expectCode: "fetch_error",
      expectExtra: { stage: "discovery", kind: "unexpected" },
      build: (fail) => ({ discover: fail, download: vi.fn(), extractText: vi.fn(), registry: { get: () => fakeAdapter }, store: new FakeStore() }),
    },
    {
      name: "download throws",
      expectCode: "fetch_error",
      expectExtra: { stage: "download", kind: "unexpected" },
      build: (fail) => ({
        discover: async () => ({ status: "found", pdfUrl: NEWEST_PDF_URL, title: "x" }),
        download: fail,
        extractText: vi.fn(),
        registry: { get: () => fakeAdapter },
        store: new FakeStore(),
      }),
    },
    {
      name: "extractText throws",
      expectCode: "parse_error",
      expectExtra: { reason: "unexpected" },
      build: (fail) => ({
        discover: async () => ({ status: "found", pdfUrl: NEWEST_PDF_URL, title: "x" }),
        download: async () => ({ ok: true, bytes: new Uint8Array(), fetchedAt: new Date() }),
        extractText: fail,
        registry: { get: () => fakeAdapter },
        store: new FakeStore(),
      }),
    },
    {
      name: "canHandle throws",
      expectCode: "parse_error",
      expectExtra: { reason: "unexpected" },
      build: (fail) => ({
        discover: async () => ({ status: "found", pdfUrl: NEWEST_PDF_URL, title: "x" }),
        download: async () => ({ ok: true, bytes: new Uint8Array(), fetchedAt: new Date() }),
        extractText: async () => ({ ok: true, text: "t" }),
        registry: { get: () => ({ ...fakeAdapter, canHandle: fail }) },
        store: new FakeStore(),
      }),
    },
    {
      name: "extract throws",
      expectCode: "parse_error",
      expectExtra: { reason: "unexpected" },
      build: (fail) => ({
        discover: async () => ({ status: "found", pdfUrl: NEWEST_PDF_URL, title: "x" }),
        download: async () => ({ ok: true, bytes: new Uint8Array(), fetchedAt: new Date() }),
        extractText: async () => ({ ok: true, text: "t" }),
        registry: { get: () => ({ ...fakeAdapter, extract: fail }) },
        store: new FakeStore(),
      }),
    },
    {
      name: "findReport throws",
      expectCode: "persist_error",
      expectExtra: { reportDate: "2026-09-22" },
      build: (fail) => {
        const s = new FakeStore();
        s.findReportImpl = async () => fail();
        return stubPipelineDeps(fakeAdapter, "text", s);
      },
    },
    {
      name: "saveReport throws",
      expectCode: "persist_error",
      expectExtra: { reportDate: "2026-09-22" },
      build: (fail) => {
        const s = new FakeStore();
        s.saveReportImpl = async () => fail();
        return stubPipelineDeps(fakeAdapter, "text", s);
      },
    },
  ];

  for (const t of throwers) {
    it(`IF-8b: ${t.name} (Error) never throws out of ingestEtf`, async () => {
      const deps = t.build(() => {
        throw new Error("boom");
      });
      const outcome = await ingestEtf(etf, deps);
      expect(INGEST_OUTCOME_CODES).toContain(outcome.code);
      expect(outcome.code).toBe(t.expectCode);
      if (t.expectExtra) {
        expect(outcome).toMatchObject(t.expectExtra);
      }
    });

    it(`IF-8b: ${t.name} (non-Error) never throws out of ingestEtf`, async () => {
      const deps = t.build(() => {
        throw "plain";
      });
      const outcome = await ingestEtf(etf, deps);
      expect(INGEST_OUTCOME_CODES).toContain(outcome.code);
      expect(outcome.code).toBe(t.expectCode);
    });
  }

  it("IF-8c: only ok/parse_error statuses are ever sent to saveReport, both occur, and the type is closed", () => {
    expect(allSaveReportInputs.length).toBeGreaterThan(0);
    const statuses = new Set(allSaveReportInputs.map((c) => c.status));
    for (const status of statuses) {
      expect(["ok", "parse_error"]).toContain(status);
    }
    expect(statuses.has("ok")).toBe(true);
    expect(statuses.has("parse_error")).toBe(true);
    expectTypeOf<SaveReportInput["status"]>().toEqualTypeOf<"ok" | "parse_error">();
  });
});
