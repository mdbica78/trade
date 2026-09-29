import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../test/helpers/pglite";
import { withNewestRowHrefs } from "../../test/helpers/filing-page";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import { discoverLatestReport } from "../extraction/discovery";
import { downloadReportPdf, extractPdfText } from "../extraction/pdf";
import { FakeLinkStore, FIXED_NOW } from "../../test/helpers/ingest-fakes";
import { createDrizzleReportStore } from "./store";
import { createHomeTableLoader } from "../monitoring/home";
import { createEtfHistoryLoader } from "../monitoring/history";
import { ingestEtf, type IngestDeps, type IngestEtfInput } from "./ingest-etf";

const FIXTURES_DIR = path.join(__dirname, "..", "..", "test", "fixtures");
const BVB_DIR = path.join(FIXTURES_DIR, "bvb");

const INSTRUMENT_PAGE_URL = "https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=BTBETRETF";
const URL_OLD = "https://bvb.ro/infocont/infocont26/BTBETRETF_OLD_20260921093218_21-09-2026.pdf";
const URL_NEW = "https://bvb.ro/infocont/infocont26/BTBETRETF_NEW_20260922092427_22-09-2026.pdf";

const expectedFixtures = JSON.parse(readFileSync(path.join(FIXTURES_DIR, "expected.json"), "utf8")) as {
  fixtures: { file: string; values: Record<string, { rawValue: string; numericValue: string }> }[];
};
function expectedValuesFor(file: string) {
  return expectedFixtures.fixtures.find((f) => f.file === file)!.values;
}

function twoLinkPageHtml(): string {
  const instrumentHtml = readFileSync(path.join(BVB_DIR, "BTBETRETF-instrument-2026-09-23.html"), "utf8");
  // Decoy dates in the row title/publishedAt don't matter: report_date comes only from each
  // PDF's own footer text (US-037 §0.1). URL_OLD then URL_NEW: URL_NEW is later in the row, so
  // the comparator (later-in-row wins, D-1) puts it first, newest first.
  return withNewestRowHrefs(instrumentHtml, [URL_OLD, URL_NEW]);
}

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
    links: new FakeLinkStore(),
    now: () => FIXED_NOW,
  };
}

describe("ingestEtf over a two-report filing, real discovery/PDF/adapter/store on PGlite (US-037)", () => {
  it(
    "MFP-1: two report links in the newest row give two ok reports, each with its own file's values",
    async () => {
      const html = twoLinkPageHtml();
      const fetchImpl = makeFetchImpl({
        [INSTRUMENT_PAGE_URL]: () => new Response(html, { status: 200 }),
        [URL_OLD]: () => new Response(new Uint8Array(readFileSync(path.join(FIXTURES_DIR, "BTBETRETF-2026-09-21.pdf"))), { status: 200 }),
        [URL_NEW]: () => new Response(new Uint8Array(readFileSync(path.join(FIXTURES_DIR, "BTBETRETF-2026-09-22.pdf"))), { status: 200 }),
      });
      const etf: IngestEtfInput = {
        id: db.etfId,
        symbol: "BTBETRETF",
        bvbUrl: INSTRUMENT_PAGE_URL,
        adapterKey: "brd-depositary",
        trackedFieldKeys: ["nav_per_unit"],
      };

      const outcome = await ingestEtf(etf, deps(fetchImpl));
      expect(outcome).toMatchObject({ code: "ok", reportDate: "2026-09-22", sourceUrl: URL_NEW, valuesWritten: 16 });

      const reports = await db.pg.query<{ report_date: string; status: string; source_url: string }>(
        'select "report_date"::text, "status", "source_url" from "reports" order by "report_date"',
      );
      expect(reports.rows).toEqual([
        { report_date: "2026-09-21", status: "ok", source_url: URL_OLD },
        { report_date: "2026-09-22", status: "ok", source_url: URL_NEW },
      ]);

      for (const [reportDate, url, file] of [
        ["2026-09-21", URL_OLD, "BTBETRETF-2026-09-21.pdf"],
        ["2026-09-22", URL_NEW, "BTBETRETF-2026-09-22.pdf"],
      ] as const) {
        const expected = expectedValuesFor(file);
        const values = await db.pg.query<{ field_key: string; numeric_value: string; raw_value: string }>(
          `select "rv"."field_key", "rv"."numeric_value"::text, "rv"."raw_value"
           from "report_values" "rv" join "reports" "r" on "r"."id" = "rv"."report_id"
           where "r"."report_date"::text = $1 order by "rv"."field_key"`,
          [reportDate],
        );
        expect(values.rows).toEqual(
          Object.keys(expected)
            .map((fieldKey) => ({ field_key: fieldKey, numeric_value: expected[fieldKey].numericValue, raw_value: expected[fieldKey].rawValue }))
            .sort((a, b) => a.field_key.localeCompare(b.field_key)),
        );
        void url;
      }
    },
    30_000,
  );

  it(
    "MFP-3: a re-run skips both URLs (already_ingested), the stored snapshot is byte-identical",
    async () => {
      const html = twoLinkPageHtml();
      const fetchImpl1 = makeFetchImpl({
        [INSTRUMENT_PAGE_URL]: () => new Response(html, { status: 200 }),
        [URL_OLD]: () => new Response(new Uint8Array(readFileSync(path.join(FIXTURES_DIR, "BTBETRETF-2026-09-21.pdf"))), { status: 200 }),
        [URL_NEW]: () => new Response(new Uint8Array(readFileSync(path.join(FIXTURES_DIR, "BTBETRETF-2026-09-22.pdf"))), { status: 200 }),
      });
      const etf: IngestEtfInput = {
        id: db.etfId,
        symbol: "BTBETRETF",
        bvbUrl: INSTRUMENT_PAGE_URL,
        adapterKey: "brd-depositary",
        trackedFieldKeys: ["nav_per_unit"],
      };
      await ingestEtf(etf, deps(fetchImpl1));

      const reportsBefore = await db.pg.query('select * from "reports" order by "id"');
      const valuesBefore = await db.pg.query('select * from "report_values" order by "id"');

      const fetchImpl2 = makeFetchImpl({ [INSTRUMENT_PAGE_URL]: () => new Response(html, { status: 200 }) });
      const outcome = await ingestEtf(etf, deps(fetchImpl2));
      expect(outcome).toMatchObject({ code: "already_ingested", detail: "stored 0, already stored 2, failed 0, not attempted 0" });
      expect(fetchImpl2).toHaveBeenCalledTimes(1);

      const reportsAfter = await db.pg.query('select * from "reports" order by "id"');
      const valuesAfter = await db.pg.query('select * from "report_values" order by "id"');
      expect(reportsAfter.rows).toEqual(reportsBefore.rows);
      expect(valuesAfter.rows).toEqual(valuesBefore.rows);
    },
    30_000,
  );

  it(
    "DV-1: display stays tracked-only while storage carries every field (AC6)",
    async () => {
      for (const [fieldKey, order] of [["nav_per_unit", 0], ["units_in_circulation", 1]] as const) {
        await db.pg.query(
          `insert into "field_catalog" ("adapter_key", "field_key", "label_ro", "label_en") values ($1, $2, $3, $4)`,
          ["brd-depositary", fieldKey, fieldKey, fieldKey],
        );
        await db.pg.query(`insert into "tracked_fields" ("etf_id", "field_key", "display_order") values ($1, $2, $3)`, [
          db.etfId,
          fieldKey,
          order,
        ]);
      }
      const html = twoLinkPageHtml();
      const fetchImpl = makeFetchImpl({
        [INSTRUMENT_PAGE_URL]: () => new Response(html, { status: 200 }),
        [URL_OLD]: () => new Response(new Uint8Array(readFileSync(path.join(FIXTURES_DIR, "BTBETRETF-2026-09-21.pdf"))), { status: 200 }),
        [URL_NEW]: () => new Response(new Uint8Array(readFileSync(path.join(FIXTURES_DIR, "BTBETRETF-2026-09-22.pdf"))), { status: 200 }),
      });
      const etf: IngestEtfInput = {
        id: db.etfId,
        symbol: "BTBETRETF",
        bvbUrl: INSTRUMENT_PAGE_URL,
        adapterKey: "brd-depositary",
        trackedFieldKeys: ["nav_per_unit", "units_in_circulation"],
      };
      await ingestEtf(etf, deps(fetchImpl));

      const homeLoader = createHomeTableLoader(db.mockDb, defaultAdapterRegistry, db.runner);
      const home = await homeLoader();
      expect(home.columns.map((c) => c.fieldKey).sort()).toEqual(["nav_per_unit", "units_in_circulation"]);
      const row = home.rows.find((r) => r.symbol === "BTBETRETF")!;
      expect(Object.keys(row.cells).sort()).toEqual(["nav_per_unit", "units_in_circulation"]);

      const historyLoader = createEtfHistoryLoader(db.mockDb, db.runner, defaultAdapterRegistry);
      const history = await historyLoader("BTBETRETF");
      expect(history!.fields.map((f) => f.fieldKey).sort()).toEqual(["nav_per_unit", "units_in_circulation"]);
      for (const row of history!.rows) {
        expect(Object.keys(row.values).sort()).toEqual(["nav_per_unit", "units_in_circulation"]);
      }
    },
    30_000,
  );
});
