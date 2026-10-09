import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../test/helpers/pglite";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import { createAdapterRegistry } from "../extraction/adapters/registry";
import type { ExtractionAdapter } from "../extraction/adapters/types";
import { createDrizzleEtfLoader } from "../ingestion/load-etfs";
import { createHomeTableLoader } from "../monitoring/home";
import {
  listFieldsForEtf,
  moveField,
  trackField,
  untrackField,
  type TrackedFieldDeps,
} from "./tracked-fields";

const CATALOGUE = [
  { fieldKey: "net_asset", labelRo: "Activ net", labelEn: "Net asset", unit: "RON" },
  { fieldKey: "units_in_circulation", labelRo: "Unități în circulație", labelEn: "Units in circulation", unit: "count" },
  { fieldKey: "units_held_individuals", labelRo: "Unități persoane fizice", labelEn: "Units held by individuals", unit: "count" },
  { fieldKey: "units_held_legal_entities", labelRo: "Unități persoane juridice", labelEn: "Units held by legal entities", unit: "count" },
  { fieldKey: "nav_per_unit", labelRo: "VUAN", labelEn: "Net asset value per unit", unit: "RON" },
  { fieldKey: "investors_total", labelRo: "Investitori", labelEn: "Investors", unit: "count" },
  { fieldKey: "investors_individuals", labelRo: "Investitori persoane fizice", labelEn: "Individual investors", unit: "count" },
  { fieldKey: "investors_legal_entities", labelRo: "Investitori persoane juridice", labelEn: "Legal-entity investors", unit: "count" },
] as const;

let db: TestDatabase;
let tvbId: number;

beforeEach(async () => {
  db = await createTestDatabase();
  for (const row of CATALOGUE) {
    await db.pg.query(
      'insert into "field_catalog" ("adapter_key", "field_key", "label_ro", "label_en", "unit") values ($1,$2,$3,$4,$5)',
      ["brd-depositary", row.fieldKey, row.labelRo, row.labelEn, row.unit],
    );
  }
  const tvb = await db.pg.query<{ id: number }>(
    'insert into "etfs" ("symbol","name","bvb_url","adapter_key","is_active") values ($1,$2,$3,$4,$5) returning "id"',
    ["TVBETETF", "TVB fund", "https://bvb.ro/tvb", "brd-depositary", true],
  );
  tvbId = tvb.rows[0].id;
}, 30_000);
afterEach(async () => {
  await db.close();
});

function baseDeps(overrides: Partial<TrackedFieldDeps> = {}): TrackedFieldDeps {
  return { db: db.mockDb, run: db.runner, registry: defaultAdapterRegistry, ...overrides };
}

describe("listFieldsForEtf (LF)", () => {
  it("LF-1: available lists every catalogue key with tracked/position, tracked rows carry position", async () => {
    await db.pg.query('insert into "tracked_fields" ("etf_id","field_key","display_order") values ($1,$2,$3)', [
      db.etfId,
      "nav_per_unit",
      0,
    ]);
    await db.pg.query('insert into "tracked_fields" ("etf_id","field_key","display_order") values ($1,$2,$3)', [
      db.etfId,
      "units_in_circulation",
      1,
    ]);

    const view = await listFieldsForEtf("BTBETRETF", baseDeps());
    expect(view).not.toBeNull();
    expect(view!.available.map((f) => f.fieldKey)).toEqual(CATALOGUE.map((c) => c.fieldKey));

    const navRow = view!.available.find((f) => f.fieldKey === "nav_per_unit")!;
    expect(navRow.tracked).toBe(true);
    expect(navRow.position).toBe(1);
    expect(navRow.labelRo).toBe("VUAN");

    const investorsRow = view!.available.find((f) => f.fieldKey === "investors_total")!;
    expect(investorsRow.tracked).toBe(false);
    expect(investorsRow.position).toBeNull();

    expect(view!.tracked.map((t) => t.fieldKey)).toEqual(["nav_per_unit", "units_in_circulation"]);
    expect(view!.tracked[0].position).toBe(1);
    expect(view!.tracked[1].position).toBe(2);
  });

  it("LF-2: a tracked field with no catalogue row for this adapter is flagged available:false", async () => {
    await db.pg.query('insert into "tracked_fields" ("etf_id","field_key","display_order") values ($1,$2,$3)', [
      db.etfId,
      "ghost_field",
      0,
    ]);
    const view = await listFieldsForEtf("BTBETRETF", baseDeps());
    expect(view!.available.some((f) => f.fieldKey === "ghost_field")).toBe(false);
    const ghost = view!.tracked.find((t) => t.fieldKey === "ghost_field")!;
    expect(ghost.available).toBe(false);
    expect(ghost.labelRo).toBe("ghost_field");
  });

  it("LF-3: available is the intersection of the adapter's fieldKeys and the catalogue (decision 7)", async () => {
    const other: ExtractionAdapter = {
      key: "other",
      fieldKeys: ["a", "b"],
      canHandle: () => false,
      extract: () => ({ ok: false, error: "n/a" }),
    };
    await db.pg.query('update "etfs" set "adapter_key" = $1 where "symbol" = $2', ["other", "BTBETRETF"]);
    await db.pg.query(
      'insert into "field_catalog" ("adapter_key","field_key","label_ro","label_en","unit") values ($1,$2,$3,$4,$5),($1,$6,$3,$4,$5),($1,$7,$3,$4,$5)',
      ["other", "a", "L", "L", null, "b", "c"],
    );
    const registry = createAdapterRegistry([other]);
    const view = await listFieldsForEtf("BTBETRETF", baseDeps({ registry }));
    expect(view!.available.map((f) => f.fieldKey).sort()).toEqual(["a", "b"]);
  });

  it("LF-4: symbol is normalised; unknown symbol gives null", async () => {
    const view = await listFieldsForEtf("btbetretf", baseDeps());
    expect(view!.etf.symbol).toBe("BTBETRETF");
    expect(await listFieldsForEtf("NOPE", baseDeps())).toBeNull();
  });

  it("LF-5/LF-6: ETF with no or unregistered adapter has empty available, tracked rows flagged unavailable", async () => {
    await db.pg.query('insert into "tracked_fields" ("etf_id","field_key","display_order") values ($1,$2,$3)', [
      db.etfId,
      "nav_per_unit",
      0,
    ]);
    await db.pg.query('update "etfs" set "adapter_key" = null where "symbol" = $1', ["BTBETRETF"]);
    const nullView = await listFieldsForEtf("BTBETRETF", baseDeps());
    expect(nullView!.etf.adapterAvailable).toBe(false);
    expect(nullView!.available).toEqual([]);
    // With adapter_key null, the catalogue join (keyed on the ETF's own adapter) resolves
    // nothing, so the tracked row falls back to the field key as its label (same fallback
    // as lib/monitoring/history.ts).
    expect(nullView!.tracked).toEqual([{ fieldKey: "nav_per_unit", labelRo: "nav_per_unit", labelEn: "nav_per_unit", unit: null, position: 1, available: false }]);

    await db.pg.query('update "etfs" set "adapter_key" = $1 where "symbol" = $2', ["old-adapter", "BTBETRETF"]);
    const unregisteredView = await listFieldsForEtf("BTBETRETF", baseDeps());
    expect(unregisteredView!.etf.adapterAvailable).toBe(false);
    expect(unregisteredView!.available).toEqual([]);
  });
});

describe("trackField (TR)", () => {
  it("TR-1: tracks a new field, display_order 0 when nothing tracked yet", async () => {
    const result = await trackField({ symbol: "BTBETRETF", fieldKey: "nav_per_unit" }, baseDeps());
    expect(result).toEqual({ ok: true, action: "tracked", symbol: "BTBETRETF" });
    const row = await db.pg.query<{ display_order: number }>(
      'select "display_order" from "tracked_fields" where "etf_id" = $1 and "field_key" = $2',
      [db.etfId, "nav_per_unit"],
    );
    expect(row.rows[0].display_order).toBe(0);
  });

  it("TR-2: new field gets max(display_order)+1 for this ETF only, ignoring other ETFs' rows", async () => {
    await db.pg.query('insert into "tracked_fields" ("etf_id","field_key","display_order") values ($1,$2,0),($1,$3,7)', [
      db.etfId,
      "nav_per_unit",
      "units_in_circulation",
    ]);
    await db.pg.query('insert into "tracked_fields" ("etf_id","field_key","display_order") values ($1,$2,20)', [
      tvbId,
      "net_asset",
    ]);
    await trackField({ symbol: "BTBETRETF", fieldKey: "investors_total" }, baseDeps());
    const row = await db.pg.query<{ display_order: number }>(
      'select "display_order" from "tracked_fields" where "etf_id" = $1 and "field_key" = $2',
      [db.etfId, "investors_total"],
    );
    expect(row.rows[0].display_order).toBe(8);
  });

  it("TR-3: tracking an already-tracked field is a no-op", async () => {
    await db.pg.query('insert into "tracked_fields" ("etf_id","field_key","display_order") values ($1,$2,0)', [
      db.etfId,
      "nav_per_unit",
    ]);
    const before = await db.pg.query('select * from "tracked_fields" order by "id"');
    const result = await trackField({ symbol: "BTBETRETF", fieldKey: "nav_per_unit" }, baseDeps());
    expect(result).toEqual({ ok: true, action: "already_tracked", symbol: "BTBETRETF" });
    const after = await db.pg.query('select * from "tracked_fields" order by "id"');
    expect(after.rows).toEqual(before.rows);
  });

  it("TR-4: rejects fields the ETF cannot track, writing nothing", async () => {
    await db.pg.query('insert into "field_catalog" ("adapter_key","field_key","label_ro","label_en") values ($1,$2,$3,$3)', [
      "other-adapter",
      "foo",
      "Foo",
    ]);
    await db.pg.query('insert into "field_catalog" ("adapter_key","field_key","label_ro","label_en") values ($1,$2,$3,$3)', [
      "brd-depositary",
      "ghost_field",
      "Ghost",
    ]);

    const before = await db.pg.query('select * from "tracked_fields" order by "id"');

    const cases: Array<[string, string]> = [
      ["BTBETRETF", "foo"],
      ["BTBETRETF", "nope"],
      ["BTBETRETF", "ghost_field"],
    ];
    for (const [symbol, fieldKey] of cases) {
      const result = await trackField({ symbol, fieldKey }, baseDeps());
      expect(result).toEqual({ ok: false, error: "field_not_available" });
    }

    await db.pg.query('update "etfs" set "adapter_key" = null where "symbol" = $1', ["BTBETRETF"]);
    expect(await trackField({ symbol: "BTBETRETF", fieldKey: "nav_per_unit" }, baseDeps())).toEqual({
      ok: false,
      error: "field_not_available",
    });

    await db.pg.query('update "etfs" set "adapter_key" = $1 where "symbol" = $2', ["old-adapter", "BTBETRETF"]);
    await db.pg.query('insert into "field_catalog" ("adapter_key","field_key","label_ro","label_en") values ($1,$2,$3,$3)', [
      "old-adapter",
      "nav_per_unit",
      "VUAN",
    ]);
    expect(await trackField({ symbol: "BTBETRETF", fieldKey: "nav_per_unit" }, baseDeps())).toEqual({
      ok: false,
      error: "field_not_available",
    });

    expect(await trackField({ symbol: "NOPE", fieldKey: "nav_per_unit" }, baseDeps())).toEqual({
      ok: false,
      error: "not_found",
    });

    const after = await db.pg.query('select * from "tracked_fields" order by "id"');
    expect(after.rows).toEqual(before.rows);
  });

  it("TR-5: race guard — adapter cleared between read and write yields field_not_available, no insert", async () => {
    let calls = 0;
    const racyRun: typeof db.runner = async (statements) => {
      calls += 1;
      if (calls === 2) {
        await db.pg.query('update "etfs" set "adapter_key" = null where "symbol" = $1', ["BTBETRETF"]);
      }
      return db.runner(statements);
    };
    const result = await trackField({ symbol: "BTBETRETF", fieldKey: "nav_per_unit" }, baseDeps({ run: racyRun }));
    expect(result).toEqual({ ok: false, error: "field_not_available" });
    const row = await db.pg.query('select * from "tracked_fields" where "etf_id" = $1', [db.etfId]);
    expect(row.rows).toHaveLength(0);
  });

  it("TR-6: two concurrent tracks for different fields get distinct display_order values", async () => {
    const [a, b] = await Promise.all([
      trackField({ symbol: "BTBETRETF", fieldKey: "nav_per_unit" }, baseDeps()),
      trackField({ symbol: "BTBETRETF", fieldKey: "units_in_circulation" }, baseDeps()),
    ]);
    expect(a).toEqual({ ok: true, action: "tracked", symbol: "BTBETRETF" });
    expect(b).toEqual({ ok: true, action: "tracked", symbol: "BTBETRETF" });
    const rows = await db.pg.query<{ display_order: number }>(
      'select "display_order" from "tracked_fields" where "etf_id" = $1 order by "display_order"',
      [db.etfId],
    );
    expect(rows.rows.map((r) => r.display_order)).toEqual([0, 1]);
  });
});

describe("untrackField (UT)", () => {
  it("UT-1: keeps reports/report_values untouched, deletes only the one tracked_fields row", async () => {
    await db.pg.query('insert into "tracked_fields" ("etf_id","field_key","display_order") values ($1,$2,0),($1,$3,1)', [
      db.etfId,
      "nav_per_unit",
      "units_in_circulation",
    ]);
    await db.pg.query('insert into "tracked_fields" ("etf_id","field_key","display_order") values ($1,$2,0)', [
      tvbId,
      "net_asset",
    ]);
    const reportInsert = await db.pg.query<{ id: number }>(
      'insert into "reports" ("etf_id","report_date","status") values ($1,$2,$3) returning "id"',
      [db.etfId, "2026-09-22", "ok"],
    );
    await db.pg.query(
      'insert into "report_values" ("report_id","field_key","numeric_value","raw_value") values ($1,$2,$3,$4),($1,$5,$6,$7)',
      [reportInsert.rows[0].id, "nav_per_unit", "11.171", "11.171", "units_in_circulation", "100", "100"],
    );
    const reportsBefore = await db.pg.query('select * from "reports" order by "id"');
    const valuesBefore = await db.pg.query('select * from "report_values" order by "id"');

    const result = await untrackField({ symbol: "BTBETRETF", fieldKey: "nav_per_unit" }, baseDeps());
    expect(result).toEqual({ ok: true, symbol: "BTBETRETF" });

    const remaining = await db.pg.query<{ field_key: string }>('select "field_key" from "tracked_fields" where "etf_id" = $1', [db.etfId]);
    expect(remaining.rows.map((r) => r.field_key)).toEqual(["units_in_circulation"]);
    const tvbRows = await db.pg.query('select "field_key" from "tracked_fields" where "etf_id" = $1', [tvbId]);
    expect(tvbRows.rows).toHaveLength(1);

    expect((await db.pg.query('select * from "reports" order by "id"')).rows).toEqual(reportsBefore.rows);
    expect((await db.pg.query('select * from "report_values" order by "id"')).rows).toEqual(valuesBefore.rows);
  });

  it("UT-2: a flagged (not-available) field can be untracked", async () => {
    await db.pg.query('insert into "tracked_fields" ("etf_id","field_key","display_order") values ($1,$2,0)', [
      db.etfId,
      "ghost_field",
    ]);
    const result = await untrackField({ symbol: "BTBETRETF", fieldKey: "ghost_field" }, baseDeps());
    expect(result).toEqual({ ok: true, symbol: "BTBETRETF" });
  });

  it("UT-3: field not tracked / unknown symbol, nothing deleted", async () => {
    expect(await untrackField({ symbol: "BTBETRETF", fieldKey: "nav_per_unit" }, baseDeps())).toEqual({
      ok: false,
      error: "not_tracked",
    });
    expect(await untrackField({ symbol: "NOPE", fieldKey: "nav_per_unit" }, baseDeps())).toEqual({
      ok: false,
      error: "not_found",
    });
  });
});

describe("moveField (MV)", () => {
  it("MV-1: up/down swap adjacent positions", async () => {
    await db.pg.query(
      'insert into "tracked_fields" ("etf_id","field_key","display_order") values ($1,$2,0),($1,$3,1),($1,$4,2)',
      [db.etfId, "nav_per_unit", "net_asset", "units_in_circulation"],
    );
    await moveField({ symbol: "BTBETRETF", fieldKey: "units_in_circulation", direction: "up" }, baseDeps());
    let rows = await db.pg.query<{ field_key: string }>(
      'select "field_key" from "tracked_fields" where "etf_id" = $1 order by "display_order"',
      [db.etfId],
    );
    expect(rows.rows.map((r) => r.field_key)).toEqual(["nav_per_unit", "units_in_circulation", "net_asset"]);

    await moveField({ symbol: "BTBETRETF", fieldKey: "nav_per_unit", direction: "down" }, baseDeps());
    rows = await db.pg.query('select "field_key" from "tracked_fields" where "etf_id" = $1 order by "display_order"', [
      db.etfId,
    ]);
    expect(rows.rows.map((r) => r.field_key)).toEqual(["units_in_circulation", "nav_per_unit", "net_asset"]);
  });

  it("MV-2: renumbers to a strict gap-free 0..n-1 order even starting from gaps/duplicates", async () => {
    await db.pg.query(
      'insert into "tracked_fields" ("etf_id","field_key","display_order") values ($1,$2,5),($1,$3,5),($1,$4,9)',
      [db.etfId, "nav_per_unit", "net_asset", "units_in_circulation"],
    );
    await moveField({ symbol: "BTBETRETF", fieldKey: "units_in_circulation", direction: "up" }, baseDeps());
    const rows = await db.pg.query<{ display_order: number }>(
      'select "display_order" from "tracked_fields" where "etf_id" = $1 order by "display_order"',
      [db.etfId],
    );
    expect(rows.rows.map((r) => r.display_order)).toEqual([0, 1, 2]);
  });

  it("MV-3: moving the first field up (or last down) is a no-op, snapshot unchanged", async () => {
    await db.pg.query(
      'insert into "tracked_fields" ("etf_id","field_key","display_order") values ($1,$2,0),($1,$3,1)',
      [db.etfId, "nav_per_unit", "net_asset"],
    );
    const before = await db.pg.query('select * from "tracked_fields" where "etf_id" = $1 order by "id"', [db.etfId]);
    const up = await moveField({ symbol: "BTBETRETF", fieldKey: "nav_per_unit", direction: "up" }, baseDeps());
    expect(up).toEqual({ ok: true, moved: false, symbol: "BTBETRETF" });
    const down = await moveField({ symbol: "BTBETRETF", fieldKey: "net_asset", direction: "down" }, baseDeps());
    expect(down).toEqual({ ok: true, moved: false, symbol: "BTBETRETF" });
    const after = await db.pg.query('select * from "tracked_fields" where "etf_id" = $1 order by "id"', [db.etfId]);
    expect(after.rows).toEqual(before.rows);
  });

  it("MV-4: TVBETETF's rows are untouched by a BTBETRETF move", async () => {
    await db.pg.query(
      'insert into "tracked_fields" ("etf_id","field_key","display_order") values ($1,$2,0),($1,$3,1)',
      [db.etfId, "nav_per_unit", "net_asset"],
    );
    await db.pg.query('insert into "tracked_fields" ("etf_id","field_key","display_order") values ($1,$2,0)', [
      tvbId,
      "net_asset",
    ]);
    const before = await db.pg.query('select * from "tracked_fields" where "etf_id" = $1 order by "id"', [tvbId]);
    await moveField({ symbol: "BTBETRETF", fieldKey: "net_asset", direction: "up" }, baseDeps());
    const after = await db.pg.query('select * from "tracked_fields" where "etf_id" = $1 order by "id"', [tvbId]);
    expect(after.rows).toEqual(before.rows);
  });

  it("MV-5: exactly one runner call is made for a move, so two quick clicks cannot race", async () => {
    await db.pg.query(
      'insert into "tracked_fields" ("etf_id","field_key","display_order") values ($1,$2,0),($1,$3,1)',
      [db.etfId, "nav_per_unit", "net_asset"],
    );
    let calls = 0;
    const countingRun: typeof db.runner = (statements) => {
      calls += 1;
      return db.runner(statements);
    };
    await moveField({ symbol: "BTBETRETF", fieldKey: "net_asset", direction: "up" }, baseDeps({ run: countingRun }));
    expect(calls).toBe(1);
  });

  it("MV-6: a failure during the call leaves the ETF's order unchanged (one atomic call, no half-renumbered state)", async () => {
    await db.pg.query(
      'insert into "tracked_fields" ("etf_id","field_key","display_order") values ($1,$2,0),($1,$3,1)',
      [db.etfId, "nav_per_unit", "net_asset"],
    );
    const before = await db.pg.query('select * from "tracked_fields" where "etf_id" = $1 order by "id"', [db.etfId]);
    const failingRun: typeof db.runner = (statements) =>
      db.runner([...statements, db.mockDb.execute(sql`select 1/0`)]);
    await expect(
      moveField({ symbol: "BTBETRETF", fieldKey: "net_asset", direction: "up" }, baseDeps({ run: failingRun })),
    ).rejects.toThrow();
    const after = await db.pg.query('select * from "tracked_fields" where "etf_id" = $1 order by "id"', [db.etfId]);
    expect(after.rows).toEqual(before.rows);
  });

  it("MV-7: untracked field or unknown symbol, nothing written", async () => {
    expect(await moveField({ symbol: "BTBETRETF", fieldKey: "nav_per_unit", direction: "up" }, baseDeps())).toEqual({
      ok: false,
      error: "not_tracked",
    });
    expect(await moveField({ symbol: "NOPE", fieldKey: "nav_per_unit", direction: "up" }, baseDeps())).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("MV-U1: an invalid direction is rejected with zero runner calls", async () => {
    let calls = 0;
    const countingRun: typeof db.runner = (statements) => {
      calls += 1;
      return db.runner(statements);
    };
    const result = await moveField(
      { symbol: "BTBETRETF", fieldKey: "nav_per_unit", direction: "sideways" },
      baseDeps({ run: countingRun }),
    );
    expect(result).toEqual({ ok: false, error: "invalid_direction" });
    expect(calls).toBe(0);
  });
});

describe("home table and daily job follow tracked-field changes (HF, DJ)", () => {
  it("HF-1/DJ-1: columns and per-ETF order follow track/move/untrack through the shipped loaders", async () => {
    const homeColumns = () =>
      createHomeTableLoader(db.mockDb, defaultAdapterRegistry, db.runner)().then((m) =>
        m.columns.map((c) => c.fieldKey),
      );
    const dailyKeys = (symbol: string) =>
      createDrizzleEtfLoader(db.mockDb, db.runner)().then(
        (etfs) => etfs.find((e) => e.symbol === symbol)!.trackedFieldKeys,
      );

    // (1) track BTB nav_per_unit
    await trackField({ symbol: "BTBETRETF", fieldKey: "nav_per_unit" }, baseDeps());
    expect(await homeColumns()).toEqual(["nav_per_unit"]);
    expect(await dailyKeys("BTBETRETF")).toEqual(["nav_per_unit"]);
    const home1 = await createHomeTableLoader(db.mockDb, defaultAdapterRegistry, db.runner)();
    const btbRow1 = home1.rows.find((r) => r.symbol === "BTBETRETF")!;
    expect(btbRow1.cells.nav_per_unit).toEqual({ tracked: true, value: null, delta: null });

    // (2) track BTB net_asset
    await trackField({ symbol: "BTBETRETF", fieldKey: "net_asset" }, baseDeps());
    expect(await homeColumns()).toEqual(["nav_per_unit", "net_asset"]);

    // (3) track TVB units_in_circulation then TVB net_asset
    await trackField({ symbol: "TVBETETF", fieldKey: "units_in_circulation" }, baseDeps());
    await trackField({ symbol: "TVBETETF", fieldKey: "net_asset" }, baseDeps());
    expect(await homeColumns()).toEqual(["nav_per_unit", "units_in_circulation", "net_asset"]);
    expect(await dailyKeys("TVBETETF")).toEqual(["units_in_circulation", "net_asset"]);

    // (4) move TVB net_asset up: same field, different positions across ETFs — lowest wins
    await moveField({ symbol: "TVBETETF", fieldKey: "net_asset", direction: "up" }, baseDeps());
    expect(await homeColumns()).toEqual(["nav_per_unit", "net_asset", "units_in_circulation"]);

    // (5) move BTB net_asset up
    await moveField({ symbol: "BTBETRETF", fieldKey: "net_asset", direction: "up" }, baseDeps());
    expect(await homeColumns()).toEqual(["net_asset", "nav_per_unit", "units_in_circulation"]);
    expect(await dailyKeys("BTBETRETF")).toEqual(["net_asset", "nav_per_unit"]);
    expect(await dailyKeys("TVBETETF")).toEqual(["net_asset", "units_in_circulation"]);

    // (6) untrack TVB units_in_circulation: column disappears when no active ETF tracks it
    await untrackField({ symbol: "TVBETETF", fieldKey: "units_in_circulation" }, baseDeps());
    expect(await homeColumns()).toEqual(["net_asset", "nav_per_unit"]);

    // (7) untrack BTB net_asset: TVB still tracks it, column stays
    await untrackField({ symbol: "BTBETRETF", fieldKey: "net_asset" }, baseDeps());
    expect(await homeColumns()).toEqual(["net_asset", "nav_per_unit"]);

    // (8) untrack TVB net_asset too
    await untrackField({ symbol: "TVBETETF", fieldKey: "net_asset" }, baseDeps());
    expect(await homeColumns()).toEqual(["nav_per_unit"]);
    expect(await dailyKeys("BTBETRETF")).toEqual(["nav_per_unit"]);
    expect(await dailyKeys("TVBETETF")).toEqual([]);
  }, 30_000);

  it("HF-2: an inactive ETF's tracked field produces no column when no active ETF tracks it", async () => {
    await db.pg.query('update "etfs" set "is_active" = false where "symbol" = $1', ["TVBETETF"]);
    await trackField({ symbol: "TVBETETF", fieldKey: "net_asset" }, baseDeps());
    const home = await createHomeTableLoader(db.mockDb, defaultAdapterRegistry, db.runner)();
    expect(home.columns.map((c) => c.fieldKey)).toEqual([]);
  });
});
