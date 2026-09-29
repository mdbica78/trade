import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { saveHomeDisplay, type HomeDisplayDeps } from "./home-display";

let db: EmptyTestDatabase;
let firstEtfId: number;
let secondEtfId: number;

beforeEach(async () => {
  db = await createEmptyTestDatabase();
  const active = await db.pg.query<{ id: number }>(
    `insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key", "is_active")
     values ($1, $2, $3, $4, true) returning "id"`,
    ["AAA", "Alpha", "https://bvb.ro/AAA", "a"],
  );
  firstEtfId = active.rows[0].id;
  const second = await db.pg.query<{ id: number }>(
    `insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key", "is_active")
     values ($1, $2, $3, $4, true) returning "id"`,
    ["BBB", "Beta", "https://bvb.ro/BBB", "b"],
  );
  secondEtfId = second.rows[0].id;
  await db.pg.query(
    `insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key", "is_active")
     values ('HIDDEN', 'Hidden', 'https://bvb.ro/HIDDEN', 'a', false)`,
  );
  await db.pg.query(
    `insert into "field_catalog" ("adapter_key", "field_key", "label_ro", "label_en")
     values ('a', 'net_asset', 'Activ net', 'Net assets'), ('b', 'nav_per_unit', 'VUAN', 'NAV per unit'),
            ('z', 'net_asset', 'Duplicated label', 'Duplicated label')`,
  );
}, 30_000);

afterEach(async () => {
  await db.close();
});

function deps(run = db.runner): HomeDisplayDeps {
  return { db: db.mockDb, run };
}

describe("home display config (US-047)", () => {
  it("HD-C2: atomically replaces and returns settings, ordered columns, and visibility choices", async () => {
    const saved = await saveHomeDisplay({
      showAbsolute: true,
      showPercent: false,
      showArrow: true,
      columns: [
        { fieldKey: "nav_per_unit", position: 0, showAbsolute: null, showPercent: true, showArrow: false },
        { fieldKey: "net_asset", position: 1 },
      ],
      etfs: [{ etfId: firstEtfId, visible: false }, { etfId: secondEtfId, visible: true }],
    }, deps());

    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.display.saved).toBe(true);
    expect(saved.display.showPercent).toBe(false);
    expect(saved.display.columns.map((column) => column.fieldKey)).toEqual(["nav_per_unit", "net_asset"]);
    expect(saved.display.columns[0]).toMatchObject({
      labelRo: "VUAN",
      labelEn: "NAV per unit",
      showAbsolute: null,
      showPercent: true,
      showArrow: false,
    });
    expect(saved.display.etfs.map((etf) => [etf.symbol, etf.visible])).toEqual([
      ["AAA", false],
      ["BBB", true],
    ]);

    const replaced = await saveHomeDisplay({
      showAbsolute: false,
      showPercent: true,
      showArrow: false,
      columns: [],
      etfs: [{ etfId: firstEtfId, visible: true }, { etfId: secondEtfId, visible: false }],
    }, deps());
    expect(replaced.ok && replaced.display.columns).toEqual([]);
    expect(replaced.ok && replaced.display.showAbsolute).toBe(false);
    expect((await db.pg.query<{ count: number }>(`select count(*)::int as count from "home_display_settings"`)).rows[0].count).toBe(1);
  });

  it.each([
    ["invalid global switch", { showAbsolute: 1, showPercent: true, showArrow: true, columns: [], etfs: [] }, "invalid_input"],
    ["duplicate field", { showAbsolute: true, showPercent: true, showArrow: true, columns: [
      { fieldKey: "net_asset", position: 0 }, { fieldKey: "net_asset", position: 1 },
    ], etfs: [] }, "duplicate_field"],
    ["duplicate position", { showAbsolute: true, showPercent: true, showArrow: true, columns: [
      { fieldKey: "net_asset", position: 0 }, { fieldKey: "nav_per_unit", position: 0 },
    ], etfs: [] }, "duplicate_position"],
    ["invalid position", { showAbsolute: true, showPercent: true, showArrow: true, columns: [
      { fieldKey: "net_asset", position: -1 },
    ], etfs: [] }, "invalid_input"],
  ] as const)("HD-C3: rejects %s", async (_label, input, error) => {
    expect(await saveHomeDisplay(input, deps())).toEqual({ ok: false, error });
  });

  it("HD-C4: rejects unknown/inactive ETFs and fields absent from field_catalog", async () => {
    const inactive = await db.pg.query<{ id: number }>(
      `select "id" from "etfs" where "symbol" = 'HIDDEN'`,
    );
    const unknownEtf = await saveHomeDisplay({
      showAbsolute: true, showPercent: true, showArrow: true, columns: [],
      etfs: [{ etfId: inactive.rows[0].id, visible: true }],
    }, deps());
    expect(unknownEtf).toEqual({ ok: false, error: "unknown_etf" });

    const unknownField = await saveHomeDisplay({
      showAbsolute: true, showPercent: true, showArrow: true,
      columns: [{ fieldKey: "not_catalogued", position: 0 }], etfs: [],
    }, deps());
    expect(unknownField).toEqual({ ok: false, error: "unknown_field" });
  });

  it("HD-C5: a write-batch failure rolls back all state replacement statements", async () => {
    const initial = {
      showAbsolute: true,
      showPercent: true,
      showArrow: true,
      columns: [{ fieldKey: "net_asset", position: 0 }],
      etfs: [{ etfId: firstEtfId, visible: false }],
    };
    expect((await saveHomeDisplay(initial, deps())).ok).toBe(true);

    const failWriteBatch = async (statements: readonly ReturnType<typeof db.mockDb.execute>[]) => {
      if (statements.length >= 4) {
        return db.runner([
          ...statements,
          db.mockDb.execute(sql`insert into "table_that_does_not_exist" default values`),
        ]);
      }
      return db.runner(statements);
    };
    await expect(saveHomeDisplay({
      showAbsolute: false,
      showPercent: false,
      showArrow: false,
      columns: [{ fieldKey: "nav_per_unit", position: 0 }],
      etfs: [{ etfId: firstEtfId, visible: true }],
    }, deps(failWriteBatch))).rejects.toThrow();

    const settings = await db.pg.query<{ show_absolute: boolean }>(
      `select "show_absolute" from "home_display_settings" where "id" = 1`,
    );
    const columns = await db.pg.query<{ field_key: string }>(
      `select "field_key" from "home_display_columns" order by "position"`,
    );
    const visibility = await db.pg.query<{ visible: boolean }>(
      `select "visible" from "home_display_etfs" where "etf_id" = $1`,
      [firstEtfId],
    );
    expect(settings.rows[0].show_absolute).toBe(true);
    expect(columns.rows.map((row) => row.field_key)).toEqual(["net_asset"]);
    expect(visibility.rows[0].visible).toBe(false);
  });
});
