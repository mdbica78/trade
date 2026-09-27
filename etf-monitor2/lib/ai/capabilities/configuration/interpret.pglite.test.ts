import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../../../test/helpers/pglite";
import { defaultAdapterRegistry } from "../../../extraction/adapters/default-registry";
import { seed } from "../../../db/seed";
import { loadConfigurationContext } from "./context";
import { interpretConfigurationRequest } from "./interpret";
import { cannedGenerate } from "../../../../test/helpers/ai-config-context";

let db: EmptyTestDatabase;

beforeEach(async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("real network forbidden");
    }),
  );
  db = await createEmptyTestDatabase();
  await seed(db.mockDb, db.runner);
}, 30_000);

afterEach(async () => {
  await db.close();
});

async function snapshot() {
  return {
    etfs: (await db.pg.query('select * from "etfs" order by "id"')).rows,
    trackedFields: (await db.pg.query('select * from "tracked_fields" order by "id"')).rows,
    settings: (await db.pg.query('select * from "settings" order by "id"')).rows,
    fieldCatalog: (await db.pg.query('select * from "field_catalog" order by "id"')).rows,
  };
}

describe("interpretConfigurationRequest against a seeded context (CXP)", () => {
  it("CXP-1: interpretation writes nothing (add_etf and track_field intents leave every table unchanged)", async () => {
    const context = await loadConfigurationContext({ db: db.mockDb, run: db.runner, registry: defaultAdapterRegistry });
    const before = await snapshot();

    const added = await interpretConfigurationRequest(
      "add ETF XYZ",
      context,
      cannedGenerate('{"action":"add_etf","symbol":"XYZ","name":null}'),
    );
    expect(added.kind).toBe("intent");

    const tracked = await interpretConfigurationRequest(
      "urmărește și activul net pentru BTBETRETF",
      context,
      cannedGenerate('{"action":"track_field","symbol":"BTBETRETF","field":"net_asset"}'),
    );
    expect(tracked.kind).toBe("intent");

    const after = await snapshot();
    expect(after).toEqual(before);
  });

  it("CXP-2: seed tracks nav_per_unit already, so track_field for it is already_tracked; net_asset is a fresh intent", async () => {
    const context = await loadConfigurationContext({ db: db.mockDb, run: db.runner, registry: defaultAdapterRegistry });

    const netAsset = await interpretConfigurationRequest(
      "urmărește și activul net pentru BTBETRETF",
      context,
      cannedGenerate('{"action":"track_field","symbol":"BTBETRETF","field":"net_asset"}'),
    );
    expect(netAsset).toEqual({ kind: "intent", intent: { action: "track_field", symbol: "BTBETRETF", field: "net_asset" } });

    const navPerUnit = await interpretConfigurationRequest(
      "also track VUAN for BTBETRETF",
      context,
      cannedGenerate('{"action":"track_field","symbol":"BTBETRETF","field":"nav_per_unit"}'),
    );
    expect(navPerUnit).toEqual({ kind: "unclear", reason: "already_tracked", symbol: "BTBETRETF", field: "nav_per_unit" });
  });
});
