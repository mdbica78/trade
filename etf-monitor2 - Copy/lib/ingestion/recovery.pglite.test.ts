import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import { discoverLatestReport } from "../extraction/discovery";
import { downloadReportPdf, extractPdfText } from "../extraction/pdf";
import { detectAdapter } from "../config/detect-adapter";
import { setEtfAdapter, detectEtfAdapter, type EtfConfigDeps } from "../config/etfs";
import { trackField } from "../config/tracked-fields";
import { createHomeTableLoader } from "../monitoring/home";
import { createEtfHistoryLoader } from "../monitoring/history";
import { ingestEtf, type IngestDeps, type IngestEtfInput } from "./ingest-etf";
import { createDrizzleReportLinkStore } from "./report-links";
import { createDrizzleReportStore } from "./store";

const FIXTURES_DIR = path.join(__dirname, "..", "..", "test", "fixtures");
const BVB_DIR = path.join(FIXTURES_DIR, "bvb");
const INSTRUMENT_PAGE_URL = "https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=BTBETRETF";
const NEWEST_PDF_URL =
  "https://bvb.ro/infocont/infocont26/BTBETRETF_20260923092427_VUAN-BT-Index-Rom-nia-ETF-BET-TR-22-09-2026.pdf";
const instrumentHtml = readFileSync(path.join(BVB_DIR, "BTBETRETF-instrument-2026-09-23.html"), "utf8");
const pdfBytes = new Uint8Array(readFileSync(path.join(FIXTURES_DIR, "BTBETRETF-2026-09-22.pdf")));

function makeFetchImpl(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url === INSTRUMENT_PAGE_URL) return new Response(instrumentHtml, { status: 200 });
    if (url === NEWEST_PDF_URL) return new Response(pdfBytes, { status: 200 });
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

let db: EmptyTestDatabase;

beforeEach(async () => {
  db = await createEmptyTestDatabase();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("real network forbidden");
    }),
  );
}, 30_000);

afterEach(async () => {
  vi.unstubAllGlobals();
  await db.close();
});

async function insertEtf(symbol: string): Promise<number> {
  const result = await db.pg.query<{ id: number }>(
    `insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key") values ($1, $2, $3, $4) returning "id"`,
    [symbol, `${symbol} name`, INSTRUMENT_PAGE_URL, null],
  );
  return result.rows[0].id;
}

async function insertCatalog(adapterKey: string, fieldKey: string, labelRo: string, labelEn: string) {
  await db.pg.query(
    `insert into "field_catalog" ("adapter_key", "field_key", "label_ro", "label_en") values ($1, $2, $3, $4)`,
    [adapterKey, fieldKey, labelRo, labelEn],
  );
}

describe("US-030 AC6: recovery once an adapter exists", () => {
  it("RC-1/RC-2/RC-3: no-adapter -> recovers to ok on the next ingest, home shows values and the report's link, no backfill", async () => {
    const etfId = await insertEtf("BTBETRETF");
    await insertCatalog("brd-depositary", "nav_per_unit", "VUAN", "NAV per unit");

    const noAdapterEtf: IngestEtfInput = {
      id: etfId,
      symbol: "BTBETRETF",
      bvbUrl: INSTRUMENT_PAGE_URL,
      adapterKey: null,
      trackedFieldKeys: [],
    };
    const fetchImpl = makeFetchImpl();
    const noAdapterDeps: IngestDeps = {
      discover: (e) => discoverLatestReport(e, { fetchImpl }),
      download: (u) => downloadReportPdf(u, { fetchImpl }),
      extractText: extractPdfText,
      registry: defaultAdapterRegistry,
      store: createDrizzleReportStore(db.mockDb, db.runner),
      links: createDrizzleReportLinkStore(db.mockDb, db.runner),
      now: () => new Date("2026-01-01T00:00:00Z"),
    };
    const first = await ingestEtf(noAdapterEtf, noAdapterDeps);
    expect(first.code).toBe("no_adapter");
    const linkRow = (await db.pg.query<{ source_url: string }>('select * from "etf_report_links" where "etf_id" = $1', [etfId])).rows[0];
    expect(linkRow.source_url).toBe(NEWEST_PDF_URL);

    // Give it a registered adapter (RC-1's setEtfAdapter path) and track a field.
    const etfConfigDeps: Pick<EtfConfigDeps, "db" | "run" | "registry"> = {
      db: db.mockDb,
      run: db.runner,
      registry: defaultAdapterRegistry,
    };
    const setResult = await setEtfAdapter({ symbol: "BTBETRETF", adapterKey: "brd-depositary" }, etfConfigDeps);
    expect(setResult).toEqual({ ok: true });
    await trackField({ symbol: "BTBETRETF", fieldKey: "nav_per_unit" }, etfConfigDeps);

    // Recovery ingest: now takes the normal path.
    const recoveredEtf: IngestEtfInput = { ...noAdapterEtf, adapterKey: "brd-depositary", trackedFieldKeys: ["nav_per_unit"] };
    const recoveryDeps: IngestDeps = { ...noAdapterDeps, now: () => new Date("2026-09-22T09:00:00Z") };
    const second = await ingestEtf(recoveredEtf, recoveryDeps);
    expect(second.code).toBe("ok");

    const reportRows = await db.pg.query<{ status: string }>('select * from "reports" where "etf_id" = $1', [etfId]);
    expect(reportRows.rows).toHaveLength(1);
    expect(reportRows.rows[0].status).toBe("ok");

    const homeRows = (await createHomeTableLoader(db.mockDb, defaultAdapterRegistry, db.runner)()).rows;
    const row = homeRows.find((r) => r.symbol === "BTBETRETF")!;
    expect(row.adapterAvailable).toBe(true);
    expect(row.cells.nav_per_unit).toMatchObject({ tracked: true });
    expect(row.latestPdfUrl).toBe(NEWEST_PDF_URL);

    const history = await createEtfHistoryLoader(db.mockDb, db.runner, defaultAdapterRegistry)("BTBETRETF");
    expect(history?.rows).toHaveLength(1);
  }, 30_000);

  it("RC-3: recovery via a re-detect that returns detected also gives exactly one report row, no backfill", async () => {
    const etfId = await insertEtf("BTBETRETF");
    await insertCatalog("brd-depositary", "nav_per_unit", "VUAN", "NAV per unit");
    const fetchImpl = makeFetchImpl();

    const detectDeps = {
      db: db.mockDb,
      run: db.runner,
      detect: (etf: { symbol: string; bvbUrl: string }) =>
        detectAdapter(etf, {
          discover: (e) => discoverLatestReport(e, { fetchImpl }),
          download: (u) => downloadReportPdf(u, { fetchImpl }),
          extractText: extractPdfText,
          registry: defaultAdapterRegistry,
        }),
      now: () => new Date("2026-09-27T08:00:00Z"),
    };
    const redetect = await detectEtfAdapter({ symbol: "BTBETRETF" }, detectDeps);
    expect(redetect).toMatchObject({ ok: true, adapterKey: "brd-depositary", reason: "detected" });

    await trackField(
      { symbol: "BTBETRETF", fieldKey: "nav_per_unit" },
      { db: db.mockDb, run: db.runner, registry: defaultAdapterRegistry },
    );

    const etf: IngestEtfInput = {
      id: etfId,
      symbol: "BTBETRETF",
      bvbUrl: INSTRUMENT_PAGE_URL,
      adapterKey: "brd-depositary",
      trackedFieldKeys: ["nav_per_unit"],
    };
    const ingestDeps: IngestDeps = {
      discover: (e) => discoverLatestReport(e, { fetchImpl }),
      download: (u) => downloadReportPdf(u, { fetchImpl }),
      extractText: extractPdfText,
      registry: defaultAdapterRegistry,
      store: createDrizzleReportStore(db.mockDb, db.runner),
      links: createDrizzleReportLinkStore(db.mockDb, db.runner),
      now: () => new Date("2026-09-22T09:00:00Z"),
    };
    const outcome = await ingestEtf(etf, ingestDeps);
    expect(outcome.code).toBe("ok");

    const reportRows = await db.pg.query('select * from "reports" where "etf_id" = $1', [etfId]);
    expect(reportRows.rows).toHaveLength(1);
    const history = await createEtfHistoryLoader(db.mockDb, db.runner, defaultAdapterRegistry)("BTBETRETF");
    expect(history?.rows).toHaveLength(1);
  }, 30_000);
});
