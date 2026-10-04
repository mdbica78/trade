import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import type { WidgetConfigDeps } from "./widgets";
import { addWidget, clearWidget, listWidgetsForEtf, replaceWidgets, updateWidget } from "./widgets";

let testDb: EmptyTestDatabase;
let deps: WidgetConfigDeps;
const definition = { operation: "change", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7 };

beforeEach(async () => {
  testDb = await createEmptyTestDatabase();
  deps = {
    db: testDb.mockDb,
    run: testDb.runner,
    registry: defaultAdapterRegistry,
    now: () => new Date("2026-10-03T12:00:00Z"),
  };
  await testDb.pg.query(
    `insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key") values
      ('FIRST', 'First ETF', 'https://bvb.ro/FIRST', 'brd-depositary'),
      ('SECOND', 'Second ETF', 'https://bvb.ro/SECOND', 'brd-depositary'),
      ('NOADAPTER', 'No adapter', 'https://bvb.ro/NOADAPTER', null)`,
  );
  await testDb.pg.query(
    `insert into "field_catalog" ("adapter_key", "field_key", "label_ro", "label_en") values
      ('brd-depositary', 'nav_per_unit', 'VUAN', 'NAV per unit'),
      ('brd-depositary', 'net_asset', 'Activ net', 'Net asset'),
      ('unregistered', 'unknown', 'Other', 'Other')`,
  );
});

afterEach(async () => {
  await testDb.close();
});

describe("widget config against a migrated database", () => {
  it("scopes reads to ETFs, rejects unknown or unregistered fields and ETF symbols", async () => {
    expect(await listWidgetsForEtf("MISSING", deps)).toEqual({ ok: false, error: "unknown_etf" });
    expect(await listWidgetsForEtf("FIRST", deps)).toEqual({ ok: true, value: [] });
    expect(await addWidget({ symbol: "NOADAPTER", definition }, deps)).toEqual({ ok: false, error: "unknown_field" });
    expect(await addWidget({ symbol: "FIRST", definition: { ...definition, fieldKey: "unknown" } }, deps))
      .toEqual({ ok: false, error: "unknown_field" });
    expect(await addWidget({ symbol: "FIRST", definition: { ...definition, fieldKey: "investors_individuals" } }, deps))
      .toEqual({ ok: false, error: "unknown_field" });
    expect((await testDb.pg.query(`select "id" from "etf_widgets"`)).rows).toHaveLength(0);
  });

  it("adds into the first free slot, preserves other columns on partial update and enforces six slots", async () => {
    for (let slot = 1; slot <= 6; slot++) {
      const added = await addWidget({ symbol: "FIRST", definition }, deps);
      expect(added.ok).toBe(true);
      if (added.ok) expect(added.value.slot).toBe(slot);
    }
    expect(await addWidget({ symbol: "FIRST", definition }, deps)).toEqual({ ok: false, error: "too_many" });
    expect(await updateWidget({ symbol: "FIRST", slot: 0, changes: { title: "No" } }, deps))
      .toEqual({ ok: false, error: "bad_slot" });
    expect(await updateWidget({ symbol: "FIRST", slot: 2, changes: { fieldKey: "unknown" } }, deps))
      .toEqual({ ok: false, error: "unknown_field" });
    const updated = await updateWidget({ symbol: "FIRST", slot: 2, changes: { title: "My value" } }, deps);
    expect(updated.ok).toBe(true);
    if (updated.ok) expect(updated.value).toMatchObject({ slot: 2, ...definition, title: "My value" });
    expect(await clearWidget({ symbol: "FIRST", slot: 3 }, deps)).toEqual({ ok: true, value: 1 });
    const filled = await addWidget({ symbol: "FIRST", definition: { ...definition, operation: "max" } }, deps);
    expect(filled.ok && filled.value.slot).toBe(3);
    expect((await testDb.pg.query(`select "id" from "etf_widgets"`)).rows).toHaveLength(6);
  });

  it("clears one/all only for the specified ETF and replaces in list order", async () => {
    await addWidget({ symbol: "FIRST", definition }, deps);
    await addWidget({ symbol: "SECOND", definition }, deps);
    expect(await replaceWidgets({
      symbol: "FIRST",
      definitions: [
        { ...definition, operation: "average" },
        { ...definition, operation: "min", periodUnit: "reports" },
      ],
    }, deps)).toMatchObject({ ok: true, value: [{ slot: 1, operation: "average" }, { slot: 2, operation: "min" }] });
    expect(await clearWidget({ symbol: "FIRST", slot: 1 }, deps)).toEqual({ ok: true, value: 1 });
    expect(await clearWidget({ symbol: "FIRST", slot: "all" }, deps)).toEqual({ ok: true, value: 1 });
    expect((await listWidgetsForEtf("SECOND", deps))).toMatchObject({ ok: true, value: [{ slot: 1 }] });
    expect(await replaceWidgets({ symbol: "SECOND", definitions: [] }, deps)).toEqual({ ok: true, value: [] });
    expect((await listWidgetsForEtf("SECOND", deps))).toEqual({ ok: true, value: [] });
  });

  it("rejects invalid replacements before writes and rolls back a mid-batch failure", async () => {
    await addWidget({ symbol: "FIRST", definition }, deps);
    const before = await listWidgetsForEtf("FIRST", deps);
    expect(await replaceWidgets({
      symbol: "FIRST", definitions: [definition, { ...definition, operation: "eval" }],
    }, deps)).toEqual({ ok: false, error: "unknown_operation" });
    expect(await replaceWidgets({ symbol: "FIRST", definitions: Array(7).fill(definition) }, deps))
      .toEqual({ ok: false, error: "too_many" });
    expect(await listWidgetsForEtf("FIRST", deps)).toEqual(before);

    const faulty: WidgetConfigDeps = {
      ...deps,
      run: (statements) => testDb.runner(statements.length > 2
        ? [...statements, testDb.mockDb.execute(sql`select 1 / 0`)]
        : statements),
    };
    await expect(replaceWidgets({
      symbol: "FIRST", definitions: [definition, { ...definition, operation: "min" }],
    }, faulty)).rejects.toThrow();
    expect(await listWidgetsForEtf("FIRST", deps)).toEqual(before);
  });
});
