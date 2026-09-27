import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../../../test/helpers/pglite";
import { defaultAdapterRegistry } from "../../../extraction/adapters/default-registry";
import { seed } from "../../../db/seed";
import { loadConfigurationContext } from "./context";
import { executeConfigurationIntent } from "./execute";

let db: EmptyTestDatabase;

beforeEach(async () => {
  db = await createEmptyTestDatabase();
  await seed(db.mockDb, db.runner);
}, 30_000);

afterEach(async () => {
  await db.close();
});

function deps(detect = vi.fn()) {
  return { db: db.mockDb, run: db.runner, registry: defaultAdapterRegistry, detect };
}

describe("executeConfigurationIntent against a seeded database (EXP)", () => {
  it("EXP-1: remove_etf for a symbol not in the context -> not_found (grounding pre-empts this in the chat path)", async () => {
    const context = await loadConfigurationContext(deps());
    const result = await executeConfigurationIntent({ action: "remove_etf", symbol: "ZZZETF" }, context, deps());
    expect(result.code).toBe("not_found");
  });

  it("EXP-2: track_field for a field the seed already tracks -> already_tracked, no row inserted", async () => {
    const context = await loadConfigurationContext(deps());
    const before = (await db.pg.query('select * from "tracked_fields" order by "id"')).rows;
    const result = await executeConfigurationIntent(
      { action: "track_field", symbol: "BTBETRETF", field: "nav_per_unit" },
      context,
      deps(),
    );
    expect(result.code).toBe("already_tracked");
    const after = (await db.pg.query('select * from "tracked_fields" order by "id"')).rows;
    expect(after).toEqual(before);
  });

  it("EXP-3: untrack_field for a field not tracked -> not_tracked", async () => {
    const context = await loadConfigurationContext(deps());
    const result = await executeConfigurationIntent(
      { action: "untrack_field", symbol: "BTBETRETF", field: "net_asset" },
      context,
      deps(),
    );
    expect(result.code).toBe("not_tracked");
  });

  it("EXP-4: track_field for an ETF with no adapter -> field_not_available", async () => {
    await db.pg.query(
      `insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key", "is_active") values ($1, $2, $3, null, true)`,
      ["NOADPETF", "No Adapter ETF", "https://bvb.ro/x"],
    );
    const context = await loadConfigurationContext(deps());
    const result = await executeConfigurationIntent(
      { action: "track_field", symbol: "NOADPETF", field: "net_asset" },
      context,
      deps(),
    );
    expect(result.code).toBe("field_not_available");
  });

  it("add_etf: reactivating an inactive ETF calls no detection", async () => {
    await db.pg.query('update "etfs" set "is_active" = false where "symbol" = $1', ["PTENGETF"]);
    const detect = vi.fn();
    const context = await loadConfigurationContext(deps());
    const result = await executeConfigurationIntent({ action: "add_etf", symbol: "PTENGETF", name: null }, context, deps(detect));
    expect(result.code).toBe("reactivated");
    expect(detect).not.toHaveBeenCalled();
  });

  it("add_etf: a brand-new symbol calls detection once and inserts one row with name = symbol (product #10 default)", async () => {
    const detect = vi.fn().mockResolvedValue({ adapterKey: null, reason: "no_match" });
    const context = await loadConfigurationContext(deps());
    const result = await executeConfigurationIntent({ action: "add_etf", symbol: "XYZ", name: null }, context, deps(detect));
    expect(result.code).toBe("added_no_adapter");
    expect(detect).toHaveBeenCalledTimes(1);
    const rows = (await db.pg.query('select "name", "is_active" from "etfs" where "symbol" = $1', ["XYZ"])).rows as {
      name: string;
      is_active: boolean;
    }[];
    expect(rows).toEqual([{ name: "XYZ", is_active: true }]);
  });
});
