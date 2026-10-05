import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { saveHomeDisplay } from "../config/home-display";
import { createDrizzleReportStore } from "../ingestion/store";
import type { BatchRunner } from "../ingestion/store";
import { createHomeTableLoader } from "./home";

function countingRunner(inner: BatchRunner): { run: BatchRunner; calls: { count: number } } {
  const calls = { count: 0 };
  const run: BatchRunner = async (statements) => {
    calls.count++;
    return inner(statements);
  };
  return { run, calls };
}

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
    expect(view.rows.map((row) => row.name)).toEqual(["Alpha ETF", "Beta ETF", "Gamma ETF"]);
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
    expect(view.rows.map((row) => row.name)).toEqual(["Beta ETF", "Gamma ETF"]);
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

  it("HD-H5 (US-050 B3): the label of a field key shared by two adapters comes from the lowest catalogue id everywhere", async () => {
    await db.pg.query(
      `insert into "field_catalog" ("adapter_key", "field_key", "label_ro", "label_en")
       values ('z', 'shared_field', 'Z ro', 'Z en'), ('a', 'shared_field', 'A ro', 'A en')`,
    );
    await trackFieldNow(aaaId, "shared_field", 1);

    const unsaved = await loader()();
    const unsavedColumn = unsaved.columns.find((c) => c.fieldKey === "shared_field");
    expect(unsavedColumn).toMatchObject({ labelRo: "Z ro", labelEn: "Z en" });
    const unsavedPanelEntry = unsaved.customization?.columns.find((c) => c.fieldKey === "shared_field");
    expect(unsavedPanelEntry).toMatchObject({ labelRo: "Z ro", labelEn: "Z en" });

    const saved = await saveHomeDisplay({
      showAbsolute: true,
      showPercent: true,
      showArrow: true,
      columns: [{ fieldKey: "shared_field", position: 0, showAbsolute: null, showPercent: null, showArrow: null }],
      etfs: [
        { etfId: aaaId, visible: true },
        { etfId: bbbId, visible: true },
        { etfId: cccId, visible: true },
      ],
    }, { db: db.mockDb, run: db.runner });
    expect(saved.ok).toBe(true);

    const view = await loader()();
    expect(view.columns.find((c) => c.fieldKey === "shared_field")).toMatchObject({ labelRo: "Z ro", labelEn: "Z en" });
    expect(view.customization?.columns.find((c) => c.fieldKey === "shared_field")).toMatchObject({
      labelRo: "Z ro",
      labelEn: "Z en",
    });
  });

  it("HD-H6 (US-050 B5): a tracked field with no catalogue row is in the unsaved columns but not in the panel", async () => {
    await trackFieldNow(aaaId, "no_catalogue_field", 1);

    const view = await loader()();
    expect(view.columns.map((c) => c.fieldKey)).toContain("no_catalogue_field");
    expect(view.customization?.columns.find((c) => c.fieldKey === "no_catalogue_field")).toBeUndefined();

    const saved = await saveHomeDisplay({
      showAbsolute: true,
      showPercent: true,
      showArrow: true,
      columns: view.customization!.columns.filter((c) => c.visible).map((c, position) => ({
        fieldKey: c.fieldKey,
        position,
        showAbsolute: c.showAbsolute,
        showPercent: c.showPercent,
        showArrow: c.showArrow,
      })),
      etfs: view.customization!.etfs.map(({ etfId, visible }) => ({ etfId, visible })),
    }, { db: db.mockDb, run: db.runner });
    expect(saved.ok).toBe(true);
  });

  it("HD-H7 (US-050 B2): dropping both etf_report_links and home_display_columns leaves the unsaved default view, 3 runner calls, 2 safe log lines", async () => {
    await db.pg.exec(`drop table "etf_report_links"`);
    await db.pg.exec(`drop table "home_display_columns"`);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { run, calls } = countingRunner(db.runner);

    const view = await createHomeTableLoader(db.mockDb, undefined, run)();

    const lines = spy.mock.calls
      .map((call) => call[0])
      .filter((line): line is string => typeof line === "string" && line.startsWith("[load-error]"));
    spy.mockRestore();

    expect(view.customization?.saved).toBe(false);
    expect(view.columns.map((column) => column.fieldKey)).toEqual(["nav_per_unit", "net_asset"]);
    expect(calls.count).toBe(3);
    expect(lines).toHaveLength(2);
    expect(new Set(lines.map((line) => line.split(" ")[1]))).toEqual(
      new Set(["home/report-links", "home/display-settings"]),
    );
  });

  it("HD-H8 (US-050 B2): a saved view survives a dropped etf_report_links table, 2 runner calls, 1 report-links log line", async () => {
    const saved = await saveHomeDisplay({
      showAbsolute: true,
      showPercent: true,
      showArrow: true,
      columns: [{ fieldKey: "net_asset", position: 0, showAbsolute: null, showPercent: null, showArrow: null }],
      etfs: [
        { etfId: aaaId, visible: true },
        { etfId: bbbId, visible: false },
        { etfId: cccId, visible: true },
      ],
    }, { db: db.mockDb, run: db.runner });
    expect(saved.ok).toBe(true);

    await db.pg.exec(`drop table "etf_report_links"`);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { run, calls } = countingRunner(db.runner);

    const view = await createHomeTableLoader(db.mockDb, undefined, run)();

    const lines = spy.mock.calls
      .map((call) => call[0])
      .filter((line): line is string => typeof line === "string" && line.startsWith("[load-error]"));
    spy.mockRestore();

    expect(view.customization?.saved).toBe(true);
    expect(view.columns.map((c) => c.fieldKey)).toEqual(["net_asset"]);
    expect(view.rows.map((r) => r.symbol)).toEqual(["AAA", "CCC"]);
    expect(calls.count).toBe(2);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^\[load-error\] home\/report-links /);
  });
});

async function trackFieldNow(etfId: number, fieldKey: string, displayOrder: number) {
  await db.pg.query(
    `insert into "tracked_fields" ("etf_id", "field_key", "display_order") values ($1, $2, $3)`,
    [etfId, fieldKey, displayOrder],
  );
}
