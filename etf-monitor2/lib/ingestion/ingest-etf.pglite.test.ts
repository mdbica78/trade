import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../test/helpers/pglite";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import { discoverLatestReport } from "../extraction/discovery";
import { downloadReportPdf, extractPdfText } from "../extraction/pdf";
import { ingestEtf, type IngestDeps, type IngestEtfInput } from "./ingest-etf";
import { createDrizzleReportStore } from "./store";

const FIXTURES_DIR = path.join(__dirname, "..", "..", "test", "fixtures");
const BVB_DIR = path.join(FIXTURES_DIR, "bvb");

const INSTRUMENT_PAGE_URL = "https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=BTBETRETF";
const NEWEST_PDF_URL =
  "https://bvb.ro/infocont/infocont26/BTBETRETF_20260923092427_VUAN-BT-Index-Rom-nia-ETF-BET-TR-22-09-2026.pdf";

const instrumentHtml = readFileSync(path.join(BVB_DIR, "BTBETRETF-instrument-2026-09-23.html"), "utf8");
const pdfBytes = new Uint8Array(readFileSync(path.join(FIXTURES_DIR, "BTBETRETF-2026-09-22.pdf")));
const expectedFixtures = JSON.parse(readFileSync(path.join(FIXTURES_DIR, "expected.json"), "utf8")) as {
  fixtures: { file: string; values: Record<string, { rawValue: string; numericValue: string }> }[];
};
const expectedValues = expectedFixtures.fixtures.find((f) => f.file === "BTBETRETF-2026-09-22.pdf")!.values;

function makeFetchImpl(routes: Record<string, () => Response>): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const route = routes[url];
    if (!route) return new Response("not found", { status: 404 });
    return route();
  }) as unknown as typeof fetch;
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
});

let db: TestDatabase;
beforeEach(async () => {
  db = await createTestDatabase();
}, 60_000);
afterEach(async () => {
  await db.close();
});

function deps(fetchImpl: typeof fetch): IngestDeps {
  return {
    discover: (e) => discoverLatestReport(e, { fetchImpl }),
    download: (url) => downloadReportPdf(url, { fetchImpl }),
    extractText: extractPdfText,
    registry: defaultAdapterRegistry,
    store: createDrizzleReportStore(db.mockDb, db.runner),
  };
}

describe("ingestEtf against a real Drizzle store on PGlite", () => {
  it(
    "E2E-1: happy path writes one reports row and its values, matching expected.json",
    async () => {
      const fetchImpl = makeFetchImpl({
        [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
        [NEWEST_PDF_URL]: () => new Response(pdfBytes, { status: 200 }),
      });
      const etf: IngestEtfInput = {
        id: db.etfId,
        symbol: "BTBETRETF",
        bvbUrl: INSTRUMENT_PAGE_URL,
        adapterKey: "brd-depositary",
        trackedFieldKeys: ["units_in_circulation", "nav_per_unit"],
      };

      const outcome = await ingestEtf(etf, deps(fetchImpl));
      expect(outcome.code).toBe("ok");

      const reports = await db.pg.query<{
        report_date: string;
        status: string;
        error_message: string | null;
        fetched_at: string | null;
      }>('select "report_date"::text, "status", "error_message", "fetched_at" from "reports"');
      expect(reports.rows).toHaveLength(1);
      expect(reports.rows[0].report_date).toBe("2026-09-22");
      expect(reports.rows[0].status).toBe("ok");
      expect(reports.rows[0].error_message).toBeNull();
      expect(reports.rows[0].fetched_at).not.toBeNull();

      const values = await db.pg.query<{ field_key: string; numeric_value: string; raw_value: string }>(
        'select "field_key", "numeric_value", "raw_value" from "report_values"',
      );
      expect(values.rows).toHaveLength(2);
      for (const row of values.rows) {
        expect(row.numeric_value).toBe(expectedValues[row.field_key].numericValue);
        expect(row.raw_value).toBe(expectedValues[row.field_key].rawValue);
      }
    },
    30_000,
  );

  it(
    "E2E-2: running twice gives exactly one reports row and outcomes ok then already_ingested",
    async () => {
      const fetchImpl = makeFetchImpl({
        [INSTRUMENT_PAGE_URL]: () => new Response(instrumentHtml, { status: 200 }),
        [NEWEST_PDF_URL]: () => new Response(pdfBytes, { status: 200 }),
      });
      const etf: IngestEtfInput = {
        id: db.etfId,
        symbol: "BTBETRETF",
        bvbUrl: INSTRUMENT_PAGE_URL,
        adapterKey: "brd-depositary",
        trackedFieldKeys: ["units_in_circulation", "nav_per_unit"],
      };
      const first = await ingestEtf(etf, deps(fetchImpl));
      const second = await ingestEtf(etf, deps(fetchImpl));
      expect(first.code).toBe("ok");
      expect(second.code).toBe("already_ingested");

      const reports = await db.pg.query('select * from "reports"');
      expect(reports.rows).toHaveLength(1);
      const values = await db.pg.query('select * from "report_values"');
      expect(values.rows).toHaveLength(2);
    },
    30_000,
  );
});
