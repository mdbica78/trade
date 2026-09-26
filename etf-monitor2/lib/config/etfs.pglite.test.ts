import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../test/helpers/pglite";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import { createAdapterRegistry } from "../extraction/adapters/registry";
import { createDrizzleEtfLoader } from "../ingestion/load-etfs";
import { createHomeTableLoader } from "../monitoring/home";
import {
  addEtf,
  detectEtfAdapter,
  listEtfs,
  setEtfActive,
  setEtfAdapter,
  type EtfConfigDeps,
} from "./etfs";

const FIXTURES_DIR = path.join(__dirname, "..", "..", "test", "fixtures");
const BVB_DIR = path.join(FIXTURES_DIR, "bvb");
const NEW_SYMBOL = "BTBETRETF";
const INSTRUMENT_PAGE_URL = `https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=${NEW_SYMBOL}`;

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
}, 30_000);
afterEach(async () => {
  await db.close();
});

function baseDeps(overrides: Partial<EtfConfigDeps> = {}): EtfConfigDeps {
  return {
    db: db.mockDb,
    run: db.runner,
    registry: defaultAdapterRegistry,
    detect: async () => ({ adapterKey: null, reason: "not_found" }),
    ...overrides,
  };
}

describe("listEtfs (CE-L)", () => {
  it("CE-L1: lists every ETF ordered by symbol with adapterAvailable computed", async () => {
    await db.pg.query(
      'insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key", "is_active") values ($1,$2,$3,$4,$5)',
      ["ZZZETF", "Z fund", "https://bvb.ro/z", null, false],
    );
    await db.pg.query(
      'insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key", "is_active") values ($1,$2,$3,$4,$5)',
      ["AAAETF", "A fund", "https://bvb.ro/a", "old-adapter", true],
    );

    const result = await listEtfs(baseDeps());
    expect(result.map((r) => r.symbol)).toEqual(["AAAETF", "BTBETRETF", "ZZZETF"]);

    const btb = result.find((r) => r.symbol === "BTBETRETF")!;
    expect(btb.adapterKey).toBe("brd-depositary");
    expect(btb.adapterAvailable).toBe(true);
    expect(btb.isActive).toBe(true);

    const aaa = result.find((r) => r.symbol === "AAAETF")!;
    expect(aaa.adapterKey).toBe("old-adapter");
    expect(aaa.adapterAvailable).toBe(false);

    const zzz = result.find((r) => r.symbol === "ZZZETF")!;
    expect(zzz.adapterKey).toBeNull();
    expect(zzz.adapterAvailable).toBe(false);
    expect(zzz.isActive).toBe(false);
  });
});

describe("addEtf (CE-A, CE-D)", () => {
  it("CE-A1: adds a new symbol, detects via the real chain, writes no tracked_fields/reports/report_values row", async () => {
    const instrumentHtml = readFileSync(path.join(BVB_DIR, "BTBETRETF-instrument-2026-09-23.html"), "utf8");
    const pdfBytes = new Uint8Array(readFileSync(path.join(FIXTURES_DIR, "BTBETRETF-2026-09-22.pdf")));
    const NEWEST_PDF_URL =
      "https://bvb.ro/infocont/infocont26/BTBETRETF_20260923092427_VUAN-BT-Index-Rom-nia-ETF-BET-TR-22-09-2026.pdf";
    await db.pg.query('delete from "etfs" where "symbol" = $1', [NEW_SYMBOL]);

    const { detectAdapter } = await import("./detect-adapter");
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === INSTRUMENT_PAGE_URL) return new Response(instrumentHtml, { status: 200 });
      if (url === NEWEST_PDF_URL) return new Response(pdfBytes, { status: 200 });
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;
    const { discoverLatestReport } = await import("../extraction/discovery");
    const { downloadReportPdf, extractPdfText } = await import("../extraction/pdf");

    const deps = baseDeps({
      detect: (etf) =>
        detectAdapter(etf, {
          discover: (e) => discoverLatestReport(e, { fetchImpl }),
          download: (u) => downloadReportPdf(u, { fetchImpl }),
          extractText: extractPdfText,
          registry: defaultAdapterRegistry,
        }),
    });

    const result = await addEtf({ symbol: `  ${NEW_SYMBOL.toLowerCase()} `, name: " BT Index " }, deps);
    expect(result).toEqual({
      ok: true,
      action: "added",
      symbol: NEW_SYMBOL,
      adapterKey: "brd-depositary",
      reason: "detected",
    });

    const row = await db.pg.query<{ name: string; bvb_url: string; is_active: boolean; adapter_key: string }>(
      'select "name", "bvb_url", "is_active", "adapter_key" from "etfs" where "symbol" = $1',
      [NEW_SYMBOL],
    );
    expect(row.rows[0]).toEqual({
      name: "BT Index",
      bvb_url: INSTRUMENT_PAGE_URL,
      is_active: true,
      adapter_key: "brd-depositary",
    });

    const etfId = (await db.pg.query<{ id: number }>('select "id" from "etfs" where "symbol" = $1', [NEW_SYMBOL]))
      .rows[0].id;
    const tracked = await db.pg.query('select * from "tracked_fields" where "etf_id" = $1', [etfId]);
    expect(tracked.rows).toHaveLength(0);
    const reports = await db.pg.query('select * from "reports" where "etf_id" = $1', [etfId]);
    expect(reports.rows).toHaveLength(0);
  }, 30_000);

  it("CE-A2: a symbol whose detection is null still inserts, with the reason carried in the result", async () => {
    await db.pg.query('delete from "etfs" where "symbol" = $1', [NEW_SYMBOL]);
    const deps = baseDeps({ detect: async () => ({ adapterKey: null, reason: "no_match" }) });
    const result = await addEtf({ symbol: NEW_SYMBOL, name: "BT Index" }, deps);
    expect(result).toEqual({ ok: true, action: "added", symbol: NEW_SYMBOL, adapterKey: null, reason: "no_match" });
    const row = await db.pg.query<{ adapter_key: string | null }>(
      'select "adapter_key" from "etfs" where "symbol" = $1',
      [NEW_SYMBOL],
    );
    expect(row.rows[0].adapter_key).toBeNull();
  });

  it("CE-D1: adding an active symbol returns already_monitored, writes nothing, calls detect zero times", async () => {
    const detect = vi.fn(async () => ({ adapterKey: null as string | null, reason: "not_found" as const }));
    const before = await db.pg.query('select * from "etfs" where "symbol" = $1', [NEW_SYMBOL]);
    const result = await addEtf({ symbol: NEW_SYMBOL, name: "Other" }, baseDeps({ detect }));
    expect(result).toEqual({ ok: false, error: "already_monitored" });
    expect(detect).not.toHaveBeenCalled();
    const after = await db.pg.query('select * from "etfs" where "symbol" = $1', [NEW_SYMBOL]);
    expect(after.rows).toEqual(before.rows);
  });

  it("CE-D2: adding an inactive symbol reactivates it, keeping id/name/adapter_key/history", async () => {
    await db.pg.query('update "etfs" set "is_active" = false where "symbol" = $1', [NEW_SYMBOL]);
    const reportInsert = await db.pg.query<{ id: number }>(
      'insert into "reports" ("etf_id", "report_date", "status") values ($1, $2, $3) returning "id"',
      [db.etfId, "2026-09-22", "ok"],
    );
    await db.pg.query(
      'insert into "report_values" ("report_id", "field_key", "numeric_value", "raw_value") values ($1,$2,$3,$4)',
      [reportInsert.rows[0].id, "nav_per_unit", "11.171", "11.171"],
    );
    await db.pg.query(
      'insert into "tracked_fields" ("etf_id", "field_key", "display_order") values ($1,$2,$3)',
      [db.etfId, "nav_per_unit", 0],
    );

    const detect = vi.fn(async () => ({ adapterKey: null as string | null, reason: "not_found" as const }));
    const result = await addEtf({ symbol: NEW_SYMBOL, name: "Other name" }, baseDeps({ detect }));
    expect(result).toEqual({ ok: true, action: "reactivated", symbol: NEW_SYMBOL });
    expect(detect).not.toHaveBeenCalled();

    const row = await db.pg.query<{ id: number; name: string; adapter_key: string; is_active: boolean }>(
      'select "id", "name", "adapter_key", "is_active" from "etfs" where "symbol" = $1',
      [NEW_SYMBOL],
    );
    expect(row.rows[0].id).toBe(db.etfId);
    expect(row.rows[0].name).toBe("BT Index Romania ETF BET-TR");
    expect(row.rows[0].adapter_key).toBe("brd-depositary");
    expect(row.rows[0].is_active).toBe(true);

    const reports = await db.pg.query('select * from "reports" where "etf_id" = $1', [db.etfId]);
    expect(reports.rows).toHaveLength(1);
    const values = await db.pg.query('select * from "report_values"');
    expect(values.rows).toHaveLength(1);
    const tracked = await db.pg.query('select * from "tracked_fields" where "etf_id" = $1', [db.etfId]);
    expect(tracked.rows).toHaveLength(1);
  });

  it("CE-D3: a race between the existence check and the insert never throws a unique violation", async () => {
    await db.pg.query('delete from "etfs" where "symbol" = $1', [NEW_SYMBOL]);
    let calls = 0;
    const racyRun: typeof db.runner = async (statements) => {
      calls += 1;
      if (calls === 2) {
        await db.pg.query(
          'insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key") values ($1,$2,$3,$4)',
          [NEW_SYMBOL, "Raced in", "https://bvb.ro/x", null],
        );
      }
      return db.runner(statements);
    };
    const result = await addEtf({ symbol: NEW_SYMBOL, name: "New" }, baseDeps({ run: racyRun }));
    expect(result).toEqual({ ok: false, error: "already_monitored" });
  });
});

describe("setEtfActive (CE-R)", () => {
  it("CE-R1/CE-R2: deactivate/reactivate is soft, seen by the shipped home-table and daily-job loaders", async () => {
    await db.pg.query(
      'insert into "reports" ("etf_id", "report_date", "status") values ($1,$2,$3)',
      [db.etfId, "2026-09-22", "ok"],
    );
    await db.pg.query(
      'insert into "tracked_fields" ("etf_id", "field_key", "display_order") values ($1,$2,$3)',
      [db.etfId, "nav_per_unit", 0],
    );

    const deactivate = await setEtfActive({ symbol: "BTBETRETF", active: false }, baseDeps());
    expect(deactivate).toEqual({ ok: true });

    const reports = await db.pg.query('select * from "reports" where "etf_id" = $1', [db.etfId]);
    expect(reports.rows).toHaveLength(1);
    const tracked = await db.pg.query('select * from "tracked_fields" where "etf_id" = $1', [db.etfId]);
    expect(tracked.rows).toHaveLength(1);

    const homeModel = await createHomeTableLoader(db.mockDb, defaultAdapterRegistry, db.runner)();
    expect(homeModel.rows.some((r) => r.symbol === "BTBETRETF")).toBe(false);
    const dailyEtfs = await createDrizzleEtfLoader(db.mockDb, db.runner)();
    expect(dailyEtfs.some((e) => e.symbol === "BTBETRETF")).toBe(false);

    const reactivate = await setEtfActive({ symbol: "BTBETRETF", active: true }, baseDeps());
    expect(reactivate).toEqual({ ok: true });

    const homeModel2 = await createHomeTableLoader(db.mockDb, defaultAdapterRegistry, db.runner)();
    expect(homeModel2.rows.some((r) => r.symbol === "BTBETRETF")).toBe(true);
    const dailyEtfs2 = await createDrizzleEtfLoader(db.mockDb, db.runner)();
    expect(dailyEtfs2.some((e) => e.symbol === "BTBETRETF")).toBe(true);
  }, 30_000);

  it("CE-R3: unknown symbol gives not_found, nothing written", async () => {
    const result = await setEtfActive({ symbol: "NOPE", active: false }, baseDeps());
    expect(result).toEqual({ ok: false, error: "not_found" });
  });
});

describe("setEtfAdapter / detectEtfAdapter (CE-M)", () => {
  it("CE-M1/CE-M2: stores a registered key or null", async () => {
    const set1 = await setEtfAdapter({ symbol: "BTBETRETF", adapterKey: "brd-depositary" }, baseDeps());
    expect(set1).toEqual({ ok: true });
    const set2 = await setEtfAdapter({ symbol: "BTBETRETF", adapterKey: null }, baseDeps());
    expect(set2).toEqual({ ok: true });
    const row = await db.pg.query<{ adapter_key: string | null }>(
      'select "adapter_key" from "etfs" where "symbol" = $1',
      ["BTBETRETF"],
    );
    expect(row.rows[0].adapter_key).toBeNull();
  });

  it("CE-M3: an unregistered key is rejected, row unchanged", async () => {
    const before = await db.pg.query('select "adapter_key" from "etfs" where "symbol" = $1', ["BTBETRETF"]);
    const result = await setEtfAdapter({ symbol: "BTBETRETF", adapterKey: "nope" }, baseDeps());
    expect(result).toEqual({ ok: false, error: "unknown_adapter" });
    const after = await db.pg.query('select "adapter_key" from "etfs" where "symbol" = $1', ["BTBETRETF"]);
    expect(after.rows).toEqual(before.rows);
  });

  it("CE-M4: setEtfAdapter on an unknown symbol gives not_found", async () => {
    const result = await setEtfAdapter({ symbol: "NOPE", adapterKey: null }, baseDeps());
    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("CE-M5: detectEtfAdapter stores the detected key", async () => {
    const detect = vi.fn(async () => ({ adapterKey: "brd-depositary", reason: "detected" as const }));
    const result = await detectEtfAdapter({ symbol: "BTBETRETF" }, baseDeps({ detect }));
    expect(result).toEqual({ ok: true, adapterKey: "brd-depositary", reason: "detected" });
    const row = await db.pg.query<{ adapter_key: string }>('select "adapter_key" from "etfs" where "symbol" = $1', [
      "BTBETRETF",
    ]);
    expect(row.rows[0].adapter_key).toBe("brd-depositary");
  });

  it("CE-M6: detectEtfAdapter can clear a working key to null, carrying the reason", async () => {
    const detect = vi.fn(async () => ({ adapterKey: null as string | null, reason: "fetch_error" as const }));
    const result = await detectEtfAdapter({ symbol: "BTBETRETF" }, baseDeps({ detect }));
    expect(result).toEqual({ ok: true, adapterKey: null, reason: "fetch_error" });
    const row = await db.pg.query<{ adapter_key: string | null }>(
      'select "adapter_key" from "etfs" where "symbol" = $1',
      ["BTBETRETF"],
    );
    expect(row.rows[0].adapter_key).toBeNull();
  });

  it("CE-M7: detectEtfAdapter on an unknown symbol gives not_found, detect not called", async () => {
    const detect = vi.fn(async () => ({ adapterKey: null as string | null, reason: "not_found" as const }));
    const result = await detectEtfAdapter({ symbol: "NOPE" }, baseDeps({ detect }));
    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(detect).not.toHaveBeenCalled();
  });

  it("CE-M8: detect receives the row's stored bvb_url, not one built from the input symbol", async () => {
    await db.pg.query('update "etfs" set "bvb_url" = $1 where "symbol" = $2', ["https://stored.example/x", "BTBETRETF"]);
    let seenUrl: string | undefined;
    const detect = vi.fn(async (etf: { symbol: string; bvbUrl: string }) => {
      seenUrl = etf.bvbUrl;
      return { adapterKey: null, reason: "not_found" as const };
    });
    await detectEtfAdapter({ symbol: "BTBETRETF" }, baseDeps({ detect }));
    expect(seenUrl).toBe("https://stored.example/x");
  });
});

describe("registeredAdapterKeys (CE-K)", () => {
  it("returns every registered adapter's key", async () => {
    const { registeredAdapterKeys } = await import("./etfs");
    expect(registeredAdapterKeys({ registry: defaultAdapterRegistry })).toContain("brd-depositary");
    expect(registeredAdapterKeys({ registry: createAdapterRegistry([]) })).toEqual([]);
  });
});
