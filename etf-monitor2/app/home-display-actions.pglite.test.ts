import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HomeDisplayDeps } from "@/lib/config/home-display";
import { saveHomeDisplay } from "@/lib/config/home-display";
import { createHomeTableLoader } from "@/lib/monitoring/home";
import {
  toHomeDisplaySaveInput,
  toggleHomeDisplayColumn,
  toggleHomeDisplayEtf,
  toggleHomeDisplaySwitch,
} from "@/components/home-display-state";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "@/test/helpers/pglite";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  revalidatePath: vi.fn(),
  createDeps: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: mocks.getDb }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/config/default-deps", () => ({
  createHomeDisplayConfigDeps: mocks.createDeps,
}));

import { saveHomeDisplayAction } from "./home-display-actions";

describe("home display action end-to-end (US-047 AC2/AC3/AC5/AC8)", () => {
  let database: EmptyTestDatabase;
  let deps: HomeDisplayDeps;

  beforeEach(async () => {
    database = await createEmptyTestDatabase();
    const first = await database.pg.query<{ id: number }>(
      `insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key")
       values ('AAA', 'Alpha', 'https://bvb.ro/aaa', 'brd-depositary') returning "id"`,
    );
    const second = await database.pg.query<{ id: number }>(
      `insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key")
       values ('BBB', 'Beta', 'https://bvb.ro/bbb', 'intercapital-nav') returning "id"`,
    );
    await database.pg.query(
      `insert into "field_catalog" ("adapter_key", "field_key", "label_ro", "label_en")
       values ('brd-depositary', 'net_asset', 'Activ net', 'Net assets'),
              ('intercapital-nav', 'nav_per_unit', 'VUAN', 'NAV per unit'),
              ('brd-depositary', 'unused_field', 'Nefolosit', 'Unused field')`,
    );
    await database.pg.query(
      `insert into "tracked_fields" ("etf_id", "field_key", "display_order")
       values ($1, 'net_asset', 0), ($2, 'nav_per_unit', 0)`,
      [first.rows[0].id, second.rows[0].id],
    );
    deps = { db: database.mockDb, run: database.runner };
    mocks.getDb.mockReturnValue(database.mockDb);
    mocks.createDeps.mockReturnValue(deps);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await database.close();
  });

  it("HD-A1: hides an ETF and shows it again through action, save and reload", async () => {
    const initial = await createHomeTableLoader(database.mockDb, undefined, database.runner)();
    const original = initial.customization!;
    const hidden = toggleHomeDisplayEtf(original, original.etfs[1].etfId);

    const result = await saveHomeDisplayAction(toHomeDisplaySaveInput(hidden));
    expect(result.ok).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");

    const hiddenView = await createHomeTableLoader(database.mockDb, undefined, database.runner)();
    expect(hiddenView.rows.map((row) => row.symbol)).toEqual(["AAA"]);

    const visibleAgain = toggleHomeDisplayEtf(hiddenView.customization!, hiddenView.customization!.etfs[1].etfId);
    const shownResult = await saveHomeDisplayAction(toHomeDisplaySaveInput(visibleAgain));
    expect(shownResult.ok).toBe(true);
    const shownView = await createHomeTableLoader(database.mockDb, undefined, database.runner)();
    expect(shownView.rows.map((row) => row.symbol)).toEqual(["AAA", "BBB"]);
  });

  it("HD-A2: adds an untracked catalogue field, then removes a value column", async () => {
    const initial = await createHomeTableLoader(database.mockDb, undefined, database.runner)();
    const added = toggleHomeDisplayColumn(initial.customization!, "unused_field");
    const addedResult = await saveHomeDisplayAction(toHomeDisplaySaveInput(added));
    expect(addedResult.ok).toBe(true);
    let saved = await createHomeTableLoader(database.mockDb, undefined, database.runner)();
    expect(saved.columns.map((column) => column.fieldKey)).toContain("unused_field");
    expect(saved.rows[0].cells.unused_field).toMatchObject({ tracked: true, value: null });

    const removed = toggleHomeDisplayColumn(saved.customization!, "net_asset");
    const removedResult = await saveHomeDisplayAction(toHomeDisplaySaveInput(removed));
    expect(removedResult.ok).toBe(true);
    saved = await createHomeTableLoader(database.mockDb, undefined, database.runner)();
    expect(saved.columns.map((column) => column.fieldKey)).toEqual(["nav_per_unit", "unused_field"]);
  });

  it.each([
    ["showAbsolute", "showAbsolute"] as const,
    ["showPercent", "showPercent"] as const,
    ["showArrow", "showArrow"] as const,
  ])("HD-A3: turns the %s global change switch off through action, save and reload", async (switchName, key) => {
    const initial = await createHomeTableLoader(database.mockDb, undefined, database.runner)();
    const state = toggleHomeDisplaySwitch(initial.customization!, switchName);
    const result = await saveHomeDisplayAction(toHomeDisplaySaveInput(state));
    expect(result.ok).toBe(true);
    const saved = await createHomeTableLoader(database.mockDb, undefined, database.runner)();
    expect(saved.customization?.[key]).toBe(false);
    expect(saved.columns.every((column) => column[key] === false)).toBe(true);
  });

  it("HD-A4: a per-column override takes priority over the false global setting", async () => {
    const result = await saveHomeDisplay({
      showAbsolute: false,
      showPercent: true,
      showArrow: true,
      columns: [{
        fieldKey: "net_asset",
        position: 0,
        showAbsolute: true,
        showPercent: null,
        showArrow: null,
      }],
      etfs: [],
    }, deps);
    expect(result.ok).toBe(true);
    const saved = await createHomeTableLoader(database.mockDb, undefined, database.runner)();
    expect(saved.columns).toMatchObject([{ fieldKey: "net_asset", showAbsolute: true }]);
    expect(saved.customization?.showAbsolute).toBe(false);
  });

  it("HD-A5: safely logs a failed save without exposing its error message", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.createDeps.mockReturnValue({
      ...deps,
      run: async () => {
        throw Object.assign(new Error("password=private-value"), { code: "XX001" });
      },
    });

    const result = await saveHomeDisplayAction({
      showAbsolute: true,
      showPercent: true,
      showArrow: true,
      columns: [],
      etfs: [],
    });

    expect(result).toEqual({ ok: false, error: "save_failed" });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain("[load-error] home/display-save");
    expect(spy.mock.calls[0][0]).not.toContain("private-value");
  });

  it("HD-A6: a missing home-display table returns the translated-action error result", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.createDeps.mockReturnValue({
      ...deps,
      run: async () => {
        throw Object.assign(new Error('relation "home_display_settings" does not exist'), {
          code: "42P01",
          table: "home_display_settings",
        });
      },
    });

    const result = await saveHomeDisplayAction({
      showAbsolute: true,
      showPercent: true,
      showArrow: true,
      columns: [],
      etfs: [],
    });
    expect(result).toEqual({ ok: false, error: "save_failed" });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain("[load-error] home/display-save");
    expect(spy.mock.calls[0][0]).toContain("relation=home_display_settings");
  });
});
