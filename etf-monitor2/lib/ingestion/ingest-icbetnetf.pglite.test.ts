import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { addEtf } from "../config/etfs";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import { discoverLatestReport } from "../extraction/discovery";
import { downloadReportPdf, extractPdfText } from "../extraction/pdf";
import { createHomeTableLoader } from "../monitoring/home";
import { FakeLinkStore, FIXED_NOW } from "../../test/helpers/ingest-fakes";
import { createDrizzleReportStore } from "./store";
import { ingestEtf, type IngestDeps, type IngestEtfInput } from "./ingest-etf";

const FIXTURES_DIR = path.join(__dirname, "../../test/fixtures");
const PAGE_URL = "https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=ICBETNETF";
const PDF_URL =
  "https://bvb.ro/infocont/infocont26/ICBETNETF_20260925110032_2026-09-24-BET-ETF-Official-NAV.pdf";

const expectedFixtures = JSON.parse(readFileSync(path.join(FIXTURES_DIR, "expected.json"), "utf8")) as {
  fixtures: { file: string; values: Record<string, { rawValue: string; numericValue: string }> }[];
};
const icbetnetfExpectedValues = expectedFixtures.fixtures.find((f) => f.file === "ICBETNETF-2026-09-24.pdf")!.values;

function readBytes(name: string): Uint8Array<ArrayBuffer> {
  const buf = readFileSync(path.join(FIXTURES_DIR, name));
  const out = new Uint8Array(buf.byteLength);
  out.set(buf);
  return out;
}

function readText(name: string): string {
  return readFileSync(path.join(FIXTURES_DIR, "bvb", name), "utf8");
}

function makeFetchImpl(): typeof fetch {
  const html = readText("ICBETNETF-instrument-2026-09-27.html");
  const pdfBytes = readBytes("ICBETNETF-2026-09-24.pdf");
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url === PAGE_URL) return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    if (url === PDF_URL) return new Response(pdfBytes, { status: 200, headers: { "content-type": "application/pdf" } });
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

let db: EmptyTestDatabase;

beforeEach(async () => {
  db = await createEmptyTestDatabase();
}, 60_000);

afterEach(async () => {
  await db.close();
});

async function insertEtf(symbol: string, adapterKey: string | null): Promise<number> {
  const result = await db.pg.query<{ id: number }>(
    `insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key") values ($1, $2, $3, $4) returning "id"`,
    [symbol, `${symbol} name`, PAGE_URL, adapterKey],
  );
  return result.rows[0].id;
}

async function insertCatalog(adapterKey: string, fieldKey: string, labelRo: string, labelEn: string) {
  await db.pg.query(
    `insert into "field_catalog" ("adapter_key", "field_key", "label_ro", "label_en") values ($1, $2, $3, $4)`,
    [adapterKey, fieldKey, labelRo, labelEn],
  );
}

async function trackField(etfId: number, fieldKey: string, displayOrder: number) {
  await db.pg.query(
    `insert into "tracked_fields" ("etf_id", "field_key", "display_order") values ($1, $2, $3)`,
    [etfId, fieldKey, displayOrder],
  );
}

function ingestDeps(fetchImpl: typeof fetch): IngestDeps {
  return {
    discover: (etf) => discoverLatestReport(etf, { fetchImpl }),
    download: (url) => downloadReportPdf(url, { fetchImpl }),
    extractText: extractPdfText,
    registry: defaultAdapterRegistry,
    store: createDrizzleReportStore(db.mockDb, db.runner),
    links: new FakeLinkStore(),
    now: () => FIXED_NOW,
  };
}

describe("IC-E2E: ICBETNETF end to end on PGlite (US-029 AC6)", () => {
  it("IC-E2E-1: ingestEtf stores one ok report with the tracked values", async () => {
    const etfId = await insertEtf("ICBETNETF", "intercapital-nav");
    await insertCatalog("intercapital-nav", "nav_per_unit", "VUAN", "NAV per unit");
    await insertCatalog("intercapital-nav", "units_in_circulation", "Unitati", "Units");
    await trackField(etfId, "nav_per_unit", 0);
    await trackField(etfId, "units_in_circulation", 1);

    const etf: IngestEtfInput = {
      id: etfId,
      symbol: "ICBETNETF",
      bvbUrl: PAGE_URL,
      adapterKey: "intercapital-nav",
      trackedFieldKeys: ["nav_per_unit", "units_in_circulation"],
    };
    const outcome = await ingestEtf(etf, ingestDeps(makeFetchImpl()));
    expect(outcome.code).toBe("ok");

    const reports = await db.pg.query<{ report_date: string; status: string; source_url: string }>(
      'select "report_date"::text, "status", "source_url" from "reports" where "etf_id" = $1',
      [etfId],
    );
    expect(reports.rows).toHaveLength(1);
    expect(reports.rows[0]).toMatchObject({ report_date: "2026-09-24", status: "ok", source_url: PDF_URL });

    const values = await db.pg.query<{ field_key: string; numeric_value: string; raw_value: string }>(
      `select "field_key", "numeric_value"::text, "raw_value" from "report_values" where "report_id" = (
         select "id" from "reports" where "etf_id" = $1
       ) order by "field_key"`,
      [etfId],
    );
    expect(values.rows).toEqual(
      Object.entries(icbetnetfExpectedValues)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([field_key, v]) => ({ field_key, numeric_value: v.numericValue, raw_value: v.rawValue })),
    );
  });

  it("IC-E2E-2: a rerun gives already_ingested, still one row (DEC-010 never-downgrade)", async () => {
    const etfId = await insertEtf("ICBETNETF", "intercapital-nav");
    await insertCatalog("intercapital-nav", "nav_per_unit", "VUAN", "NAV per unit");
    await trackField(etfId, "nav_per_unit", 0);

    const etf: IngestEtfInput = {
      id: etfId,
      symbol: "ICBETNETF",
      bvbUrl: PAGE_URL,
      adapterKey: "intercapital-nav",
      trackedFieldKeys: ["nav_per_unit"],
    };
    const first = await ingestEtf(etf, ingestDeps(makeFetchImpl()));
    expect(first.code).toBe("ok");
    const second = await ingestEtf(etf, ingestDeps(makeFetchImpl()));
    expect(second.code).toBe("already_ingested");

    const reports = await db.pg.query('select "id" from "reports" where "etf_id" = $1', [etfId]);
    expect(reports.rows).toHaveLength(1);
  });

  it("IC-E2E-3: the shipped home-table loader shows the ICBETNETF row with its values, date and link", async () => {
    const etfId = await insertEtf("ICBETNETF", "intercapital-nav");
    await insertCatalog("intercapital-nav", "nav_per_unit", "VUAN", "NAV per unit");
    await insertCatalog("intercapital-nav", "units_in_circulation", "Unitati", "Units");
    await trackField(etfId, "nav_per_unit", 0);
    await trackField(etfId, "units_in_circulation", 1);

    const etf: IngestEtfInput = {
      id: etfId,
      symbol: "ICBETNETF",
      bvbUrl: PAGE_URL,
      adapterKey: "intercapital-nav",
      trackedFieldKeys: ["nav_per_unit", "units_in_circulation"],
    };
    await ingestEtf(etf, ingestDeps(makeFetchImpl()));

    const loader = createHomeTableLoader(db.mockDb, defaultAdapterRegistry, db.runner);
    const { rows, columns } = await loader();
    const row = rows.find((r) => r.symbol === "ICBETNETF")!;
    expect(row.adapterAvailable).toBe(true);
    expect(row.valueDate).toBe("2026-09-24");
    expect(row.latestPdfUrl).toBe(PDF_URL);
    expect(row.cells.nav_per_unit).toMatchObject({ tracked: true, value: "142.1413" });
    expect(row.cells.units_in_circulation).toMatchObject({ tracked: true, value: "514169" });
    expect(columns.find((c) => c.fieldKey === "nav_per_unit")).toEqual({
      fieldKey: "nav_per_unit",
      labelRo: "VUAN",
      labelEn: "NAV per unit",
    });
  });

  it("IC-E2E-4: addEtf detects intercapital-nav and stores no report/values row", async () => {
    const fetchImpl = makeFetchImpl();
    const result = await addEtf(
      { symbol: "ICBETNETF" },
      {
        db: db.mockDb,
        run: db.runner,
        registry: defaultAdapterRegistry,
        detect: async (etf) => {
          const { detectAdapter } = await import("../config/detect-adapter");
          return detectAdapter(etf, {
            discover: (e) => discoverLatestReport(e, { fetchImpl }),
            download: (url) => downloadReportPdf(url, { fetchImpl }),
            extractText: extractPdfText,
            registry: defaultAdapterRegistry,
          });
        },
        now: () => FIXED_NOW,
      },
    );

    expect(result).toMatchObject({ ok: true, action: "added", symbol: "ICBETNETF", adapterKey: "intercapital-nav", reason: "detected" });

    const etfRow = await db.pg.query<{ adapter_key: string; name: string }>(
      'select "adapter_key", "name" from "etfs" where "symbol" = $1',
      ["ICBETNETF"],
    );
    expect(etfRow.rows[0].adapter_key).toBe("intercapital-nav");
    expect(etfRow.rows[0].name).toBe("INTERCAPITAL BET-TRN UCITS ETF");

    const reports = await db.pg.query('select "id" from "reports"');
    expect(reports.rows).toHaveLength(0);
    const trackedFields = await db.pg.query('select "id" from "tracked_fields"');
    expect(trackedFields.rows).toHaveLength(0);
  });
});
