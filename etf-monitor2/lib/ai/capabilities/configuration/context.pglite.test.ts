import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../../../test/helpers/pglite";
import { defaultAdapterRegistry } from "../../../extraction/adapters/default-registry";
import { seed } from "../../../db/seed";
import { loadConfigurationContext, type ConfigurationContextDeps } from "./context";

let db: EmptyTestDatabase;

beforeEach(async () => {
  db = await createEmptyTestDatabase();
  await seed(db.mockDb, db.runner);

  await db.pg.query('update "etfs" set "is_active" = false where "symbol" = $1', ["PTENGETF"]);
  await db.pg.query(
    'insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key", "is_active") values ($1,$2,$3,$4,$5)',
    ["NOADPETF", "No Adapter ETF", "https://bvb.ro/noadp", null, true],
  );
  await db.pg.query(
    'insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key", "is_active") values ($1,$2,$3,$4,$5)',
    ["GHOSTETF", "Ghost Adapter ETF", "https://bvb.ro/ghost", "ghost-adapter", true],
  );

  const tvb = await db.pg.query<{ id: number }>('select "id" from "etfs" where "symbol" = $1', ["TVBETETF"]);
  await db.pg.query('insert into "tracked_fields" ("etf_id", "field_key", "display_order") values ($1, $2, $3)', [
    tvb.rows[0]!.id,
    "net_asset",
    99,
  ]);
}, 30_000);

afterEach(async () => {
  await db.close();
});

function deps(): ConfigurationContextDeps {
  return { db: db.mockDb, run: db.runner, registry: defaultAdapterRegistry };
}

describe("loadConfigurationContext (CC)", () => {
  it("CC-1: lists all 5 ETFs in symbol order with isActive and name", async () => {
    const context = await loadConfigurationContext(deps());
    expect(context.etfs.map((e) => e.symbol)).toEqual(["BTBETRETF", "GHOSTETF", "NOADPETF", "PTENGETF", "TVBETETF"]);
    const byActive = Object.fromEntries(context.etfs.map((e) => [e.symbol, e.isActive]));
    expect(byActive).toEqual({
      BTBETRETF: true,
      GHOSTETF: true,
      NOADPETF: true,
      PTENGETF: false,
      TVBETETF: true,
    });
    expect(context.etfs.find((e) => e.symbol === "TVBETETF")!.name).toBe("Fondul Deschis de Investiții ETF BET Patria-Tradeville");
  });

  it("CC-2: NOADPETF and GHOSTETF have no available fields", async () => {
    const context = await loadConfigurationContext(deps());
    expect(context.etfs.find((e) => e.symbol === "NOADPETF")!.available).toEqual([]);
    expect(context.etfs.find((e) => e.symbol === "GHOSTETF")!.available).toEqual([]);
  });

  it("CC-3: TVBETETF tracks net_asset with both labels; BTBETRETF available has the 8 seeded catalogue keys with both labels", async () => {
    const context = await loadConfigurationContext(deps());
    const tvb = context.etfs.find((e) => e.symbol === "TVBETETF")!;
    expect(tvb.tracked).toContainEqual({ fieldKey: "net_asset", labelRo: "Activ net", labelEn: "Net asset" });

    const btb = context.etfs.find((e) => e.symbol === "BTBETRETF")!;
    expect(btb.available).toHaveLength(8);
    for (const f of btb.available) {
      expect(f.labelRo).toBeTruthy();
      expect(f.labelEn).toBeTruthy();
    }
    expect(btb.available.map((f) => f.fieldKey).sort()).toEqual(
      [
        "net_asset",
        "units_in_circulation",
        "units_held_individuals",
        "units_held_legal_entities",
        "nav_per_unit",
        "investors_total",
        "investors_individuals",
        "investors_legal_entities",
      ].sort(),
    );
  });

  it("CC-4: available/tracked keys equal what listFieldsForEtf returns", async () => {
    const { listFieldsForEtf } = await import("../../../config/tracked-fields");
    const context = await loadConfigurationContext(deps());
    for (const etf of context.etfs) {
      const view = await listFieldsForEtf(etf.symbol, deps());
      expect(view).not.toBeNull();
      expect(etf.available.map((f) => f.fieldKey).sort()).toEqual(view!.available.map((f) => f.fieldKey).sort());
      expect(etf.tracked.map((f) => f.fieldKey).sort()).toEqual(view!.tracked.map((f) => f.fieldKey).sort());
    }
  });

  it("CC-6 (US-059): each ETF carries the date of its newest status=ok report, null when it has none, inactive ETFs included", async () => {
    const id = async (symbol: string) =>
      (await db.pg.query<{ id: number }>('select "id" from "etfs" where "symbol" = $1', [symbol])).rows[0]!.id;
    const report = async (symbol: string, date: string, status: string) =>
      db.pg.query('insert into "reports" ("etf_id", "report_date", "status") values ($1,$2,$3)', [await id(symbol), date, status]);
    await report("BTBETRETF", "2026-10-01", "ok");
    await report("BTBETRETF", "2026-10-07", "ok");
    await report("BTBETRETF", "2026-10-09", "parse_error");
    await report("PTENGETF", "2026-09-30", "ok");
    await report("TVBETETF", "2026-10-08", "missing");

    const context = await loadConfigurationContext(deps());
    const dates = Object.fromEntries(context.etfs.map((e) => [e.symbol, e.lastReportDate]));
    expect(dates).toEqual({
      BTBETRETF: "2026-10-07",
      GHOSTETF: null,
      NOADPETF: null,
      PTENGETF: "2026-09-30",
      TVBETETF: null,
    });
  });

  it("CC-5: the database rows are unchanged after loading (read-only)", async () => {
    const before = await db.pg.query('select * from "etfs" order by "symbol"');
    await loadConfigurationContext(deps());
    const after = await db.pg.query('select * from "etfs" order by "symbol"');
    expect(after.rows).toEqual(before.rows);
  });
});
