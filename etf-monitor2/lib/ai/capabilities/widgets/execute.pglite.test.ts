import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../../../test/helpers/pglite";
import { defaultAdapterRegistry } from "../../../extraction/adapters/default-registry";
import type { WidgetConfigDeps } from "../../../config/widgets";
import { executeWidgetIntent } from "./execute";

let db: EmptyTestDatabase;
let deps: WidgetConfigDeps;
const definition = { operation: "change", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7 } as const;

beforeEach(async () => {
  db = await createEmptyTestDatabase();
  deps = { db: db.mockDb, run: db.runner, registry: defaultAdapterRegistry, now: () => new Date("2026-10-03T00:00:00Z") };
  await db.pg.query(
    `insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key")
      values ('BTBETRETF', 'BTB', 'https://example.invalid', 'brd-depositary')`,
  );
  await db.pg.query(
    `insert into "field_catalog" ("adapter_key", "field_key", "label_ro", "label_en")
      values ('brd-depositary', 'nav_per_unit', 'VUAN', 'NAV per unit')`,
  );
});

afterEach(async () => db.close());

describe("widget capability uses config writes against PGlite", () => {
  it("adds, updates, clears and atomically replaces through config functions", async () => {
    const added = await executeWidgetIntent({ action: "widget_add", symbol: "BTBETRETF", definition }, deps);
    expect(added).toMatchObject({ ok: true, outcome: { action: "widget_add", slot: 1, changed: true } });

    const updated = await executeWidgetIntent(
      { action: "widget_update", symbol: "BTBETRETF", slot: 1, changes: { title: "Weekly" } },
      deps,
    );
    expect(updated).toMatchObject({ ok: true, outcome: { action: "widget_update", slot: 1 } });
    expect((await db.pg.query('select "title" from "etf_widgets"')).rows).toEqual([{ title: "Weekly" }]);

    const replaced = await executeWidgetIntent(
      { action: "widget_replace", symbol: "BTBETRETF", definitions: [{ ...definition, operation: "average" }] },
      deps,
    );
    expect(replaced).toMatchObject({ ok: true, outcome: { action: "widget_replace", changed: true } });
    expect((await db.pg.query('select "operation" from "etf_widgets"')).rows).toEqual([{ operation: "average" }]);

    const cleared = await executeWidgetIntent({ action: "widget_clear", symbol: "BTBETRETF", slot: "all" }, deps);
    expect(cleared).toMatchObject({ ok: true, outcome: { action: "widget_clear", changed: true } });
    expect((await db.pg.query('select "id" from "etf_widgets"')).rows).toHaveLength(0);
  });

  it("returns closed failure without writes for an invalid config action", async () => {
    const result = await executeWidgetIntent(
      { action: "widget_add", symbol: "BTBETRETF", definition: { ...definition, fieldKey: "private_field" } },
      deps,
    );
    expect(result).toEqual({ ok: false });
    expect((await db.pg.query('select "id" from "etf_widgets"')).rows).toHaveLength(0);
  });
});
