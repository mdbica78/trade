import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { saveHomeDisplay } from "../config/home-display";
import { createDrizzleReportStore } from "../ingestion/store";
import { createHomeTableLoader } from "./home";

let db: EmptyTestDatabase;
let aaaId: number;
let bbbId: number;
let cccId: number;

beforeEach(async () => {
  db = await createEmptyTestDatabase();
  const etfs = await db.pg.query<{ id: number; symbol: string }>(
    `insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key")
     values ('AAA', 'Alpha ETF', 'https://bvb.ro/AAA', 'a'),
            ('BBB', 'Beta ETF', 'https://bvb.ro/BBB', 'b'),
            ('CCC', 'Gamma ETF', 'https://bvb.ro/CCC', 'c')
     returning "id", "symbol"`,
  );
  aaaId = etfs.rows.find((row) => row.symbol === "AAA")!.id;
  bbbId = etfs.rows.find((row) => row.symbol === "BBB")!.id;
  cccId = etfs.rows.find((row) => row.symbol === "CCC")!.id;
  await db.pg.query(
    `insert into "field_catalog" ("adapter_key", "field_key", "label_ro", "label_en")
     values ('a', 'net_asset', 'Activ net', 'Net assets'),
            ('b', 'nav_per_unit', 'VUAN', 'NAV per unit'),
            ('c', 'field_without_data', 'Fără date', 'No data yet')`,
  );
  await db.pg.query(
    `insert into "tracked_fields" ("etf_id", "field_key", "display_order")
     values ($1, 'net_asset', 0), ($2, 'nav_per_unit', 0)`,
    [aaaId, bbbId],
  );
}, 30_000);

afterEach(async () => {
  await db.close();
});

function loader() {
  return createHomeTableLoader(db.mockDb, undefined, db.runner);
}

describe("home display read model (US-047)", () => {
  it("HD-H1: no settings row preserves today's tracked-union view and prepares the default panel", async () => {
    const view = await loader()();
    expect(view.columns.map((column) => column.fieldKey)).toEqual(["nav_per_unit", "net_asset"]);
    expect(view.rows.map((row) => row.symbol)).toEqual(["AAA", "BBB", "CCC"]);
    expect(view.rows[0].cells.nav_per_unit).toEqual({ tracked: false });
    expect(view.customization).toMatchObject({
      saved: false,
      showAbsolute: true,
      showPercent: true,
      showArrow: true,
      columns: [
        { fieldKey: "nav_per_unit", visible: true },
        { fieldKey: "net_asset", visible: true },
        { fieldKey: "field_without_data", visible: false },
      ],
    });
  });

  it("HD-H2: saved view filters ETFs and columns, carries effective switches, and shows untracked stored values", async () => {
    const store = createDrizzleReportStore(db.mockDb, db.runner);
    for (const [etfId, url, value] of [
      [aaaId, "https://bvb.ro/AAA.pdf", "10"],
      [bbbId, "https://bvb.ro/BBB.pdf", "20"],
    ] as const) {
      await store.saveReport({
        etfId,
        reportDate: "2026-09-28",
        sourceUrl: url,
        fetchedAt: new Date("2026-09-28T08:00:00Z"),
        status: "ok",
        errorMessage: null,
        values: [{ fieldKey: "net_asset", numericValue: value, rawValue: value }],
      });
    }
    const saved = await saveHomeDisplay({
      showAbsolute: false,
      showPercent: true,
      showArrow: true,
      columns: [
        { fieldKey: "net_asset", position: 0, showAbsolute: true, showPercent: null, showArrow: false },
      ],
      etfs: [
        { etfId: aaaId, visible: false },
        { etfId: bbbId, visible: true },
        { etfId: cccId, visible: true },
      ],
    }, { db: db.mockDb, run: db.runner });
    expect(saved.ok).toBe(true);

    const view = await loader()();
    expect(view.columns).toEqual([{
      fieldKey: "net_asset",
      labelRo: "Activ net",
      labelEn: "Net assets",
      showAbsolute: true,
      showPercent: true,
      showArrow: false,
    }]);
    expect(view.rows.map((row) => row.symbol)).toEqual(["BBB", "CCC"]);
    expect(view.rows[0].cells.net_asset).toMatchObject({ tracked: true, value: "20" });
    expect(view.rows[1].cells.net_asset).toMatchObject({ tracked: true, value: null });
    expect(view.customization?.columns.find((column) => column.fieldKey === "field_without_data")).toMatchObject({
      visible: false,
    });
    expect(view.customization?.etfs.map((etf) => [etf.symbol, etf.visible])).toEqual([
      ["AAA", false],
      ["BBB", true],
      ["CCC", true],
    ]);
  });

  it.each(["home_display_settings", "home_display_columns", "home_display_etfs"])(
    "HD-H3: missing %s falls back to the unsaved view and logs one sanitized line",
    async (tableName) => {
      await db.pg.exec(`drop table "${tableName}"`);
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      const view = await loader()();
      const lines = spy.mock.calls
        .map((call) => call[0])
        .filter((line): line is string => typeof line === "string" && line.startsWith("[load-error]"));
      spy.mockRestore();

      expect(view.columns.map((column) => column.fieldKey)).toEqual(["nav_per_unit", "net_asset"]);
      expect(view.rows.map((row) => row.symbol)).toEqual(["AAA", "BBB", "CCC"]);
      expect(view.customization?.saved).toBe(false);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/^\[load-error\] home\/display-settings name=/);
      expect(lines[0]).toContain(`relation=${tableName}`);
    },
  );

  it("HD-H4: non-42P01 failures propagate instead of returning the default view", async () => {
    const failingRun = async () => {
      throw Object.assign(new Error("private detail"), { code: "42703" });
    };
    await expect(createHomeTableLoader(db.mockDb, undefined, failingRun)()).rejects.toMatchObject({ code: "42703" });
  });
});
