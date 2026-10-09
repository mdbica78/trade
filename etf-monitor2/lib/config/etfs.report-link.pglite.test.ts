import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../test/helpers/pglite";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import type { DetectionResult } from "./detect-adapter";
import { addEtf, detectEtfAdapter, listEtfs, type EtfConfigDeps } from "./etfs";

const NEW_SYMBOL = "XYZ";
const REPORT_URL = "https://bvb.ro/infocont/infocont26/XYZ-report.pdf";
const NOW = new Date("2026-09-27T08:00:00Z");

let db: TestDatabase;

beforeEach(async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("real network forbidden");
    }),
  );
  db = await createTestDatabase();
}, 30_000);

afterEach(async () => {
  vi.unstubAllGlobals();
  await db.close();
});

function baseDeps(detect: () => Promise<DetectionResult>, now: () => Date = () => NOW): EtfConfigDeps {
  return { db: db.mockDb, run: db.runner, registry: defaultAdapterRegistry, detect, now };
}

async function linkRow(etfId: number) {
  return (await db.pg.query('select * from "etf_report_links" where "etf_id" = $1', [etfId])).rows[0] as
    | { source_url: string; discovered_at: string }
    | undefined;
}

async function getEtfId(symbol: string): Promise<number> {
  return (await db.pg.query<{ id: number }>('select "id" from "etfs" where "symbol" = $1', [symbol])).rows[0].id;
}

describe("US-030 AC2: the form path (addEtf) stores the discovered link, whatever the detection reason", () => {
  const casesWithLink: { name: string; result: DetectionResult }[] = [
    { name: "detected", result: { adapterKey: "brd-depositary", reason: "detected", reportUrl: REPORT_URL } },
    { name: "no_match", result: { adapterKey: null, reason: "no_match", reportUrl: REPORT_URL } },
    { name: "ambiguous", result: { adapterKey: null, reason: "ambiguous", reportUrl: REPORT_URL } },
    { name: "unreadable", result: { adapterKey: null, reason: "unreadable", reportUrl: REPORT_URL } },
    { name: "fetch_error (download)", result: { adapterKey: null, reason: "fetch_error", reportUrl: REPORT_URL } },
  ];

  it.each(casesWithLink)("RL-1/RL-2: $name stores the link, keeps the reason and adapter_key as returned", async ({ result }) => {
    const deps = baseDeps(async () => result);
    const addResult = await addEtf({ symbol: NEW_SYMBOL }, deps);
    expect(addResult).toEqual({ ok: true, action: "added", symbol: NEW_SYMBOL, adapterKey: result.adapterKey, reason: result.reason });

    const etfId = await getEtfId(NEW_SYMBOL);
    const link = await linkRow(etfId);
    expect(link?.source_url).toBe(REPORT_URL);
  });

  it("RL-3: not_found and error discovery outcomes get no link row", async () => {
    for (const reason of ["not_found", "fetch_error"] as const) {
      await db.pg.query('delete from "etfs" where "symbol" = $1', [NEW_SYMBOL]);
      const deps = baseDeps(async () => ({ adapterKey: null, reason }));
      await addEtf({ symbol: NEW_SYMBOL }, deps);
      const etfId = await getEtfId(NEW_SYMBOL);
      const link = await linkRow(etfId);
      expect(link).toBeUndefined();
    }
  });

  it("RL-4: no case writes a reports, report_values or tracked_fields row (FR4.2)", async () => {
    const deps = baseDeps(async () => ({ adapterKey: "brd-depositary", reason: "detected", reportUrl: REPORT_URL }));
    await addEtf({ symbol: NEW_SYMBOL }, deps);
    const etfId = await getEtfId(NEW_SYMBOL);
    expect((await db.pg.query('select * from "reports" where "etf_id" = $1', [etfId])).rows).toHaveLength(0);
    expect((await db.pg.query('select * from "report_values"')).rows).toHaveLength(0);
    expect((await db.pg.query('select * from "tracked_fields" where "etf_id" = $1', [etfId])).rows).toHaveLength(0);
  });

  it("RL-5: detectEtfAdapter (re-detect) updates the link on a later found, but keeps it unchanged on not_found/error", async () => {
    const laterNow = new Date("2026-09-27T09:00:00Z");
    const updateDeps = baseDeps(async () => ({ adapterKey: "brd-depositary", reason: "detected", reportUrl: "https://bvb.ro/newer.pdf" }), () => laterNow);
    const result = await detectEtfAdapter({ symbol: "BTBETRETF" }, updateDeps);
    expect(result).toEqual({ ok: true, adapterKey: "brd-depositary", reason: "detected" });
    const link1 = await linkRow(db.etfId);
    expect(link1?.source_url).toBe("https://bvb.ro/newer.pdf");

    const notFoundDeps = baseDeps(async () => ({ adapterKey: null, reason: "not_found" }));
    await detectEtfAdapter({ symbol: "BTBETRETF" }, notFoundDeps);
    const link2 = await linkRow(db.etfId);
    expect(link2).toEqual(link1);

    const errorDeps = baseDeps(async () => ({ adapterKey: null, reason: "fetch_error" }));
    await detectEtfAdapter({ symbol: "BTBETRETF" }, errorDeps);
    const link3 = await linkRow(db.etfId);
    expect(link3).toEqual(link1);
  });

  it("RL-6: listEtfs and the adapter-missing flag are unaffected by the link write", async () => {
    const deps = baseDeps(async () => ({ adapterKey: null, reason: "no_match", reportUrl: REPORT_URL }));
    await addEtf({ symbol: NEW_SYMBOL }, deps);
    const list = await listEtfs(deps);
    const row = list.find((r) => r.symbol === NEW_SYMBOL)!;
    expect(row.adapterKey).toBeNull();
    expect(row.adapterAvailable).toBe(false);
  });

  it("RL-7 (AC8): a failing link write does not undo the etfs insert or change the returned result", async () => {
    let runCalls = 0;
    const throwingRun: typeof db.runner = async (statements) => {
      runCalls += 1;
      const sqlText = statements.map((s) => s.getQuery().sql).join(" ");
      if (sqlText.includes("etf_report_links")) {
        throw new Error("db down");
      }
      return db.runner(statements);
    };
    const deps: EtfConfigDeps = {
      db: db.mockDb,
      run: throwingRun,
      registry: defaultAdapterRegistry,
      detect: async () => ({ adapterKey: "brd-depositary", reason: "detected", reportUrl: REPORT_URL }),
      now: () => NOW,
    };
    const result = await addEtf({ symbol: NEW_SYMBOL }, deps);
    expect(result).toEqual({ ok: true, action: "added", symbol: NEW_SYMBOL, adapterKey: "brd-depositary", reason: "detected" });
    const etfId = await getEtfId(NEW_SYMBOL);
    expect(etfId).toBeTypeOf("number");
    expect(runCalls).toBeGreaterThan(0);
  });

  it("RL-8: a rejected-shaped href (javascript:) coming through discovery's own not_found result stores no link", async () => {
    const deps = baseDeps(async () => ({ adapterKey: null, reason: "not_found" }));
    await addEtf({ symbol: NEW_SYMBOL }, deps);
    const etfId = await getEtfId(NEW_SYMBOL);
    expect(await linkRow(etfId)).toBeUndefined();
  });
});
