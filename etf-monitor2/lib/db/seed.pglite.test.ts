import { describe, expect, it, vi } from "vitest";
import { createEmptyTestDatabase } from "../../test/helpers/pglite";
import { seedEtfs, seedFieldCatalog, seedTrackedFields } from "./seed-data";
import { buildSeedStatements, seed } from "./seed";

async function counts(pg: Awaited<ReturnType<typeof createEmptyTestDatabase>>["pg"]) {
  const etfs = await pg.query('select count(*)::int as n from "etfs"');
  const fieldCatalog = await pg.query('select count(*)::int as n from "field_catalog"');
  const trackedFields = await pg.query('select count(*)::int as n from "tracked_fields"');
  const settings = await pg.query('select count(*)::int as n from "settings"');
  return {
    etfs: (etfs.rows[0] as { n: number }).n,
    fieldCatalog: (fieldCatalog.rows[0] as { n: number }).n,
    trackedFields: (trackedFields.rows[0] as { n: number }).n,
    settings: (settings.rows[0] as { n: number }).n,
  };
}

describe("seed (SD)", () => {
  it("SD-1: fresh seed produces the expected counts and rows", async () => {
    const db = await createEmptyTestDatabase();
    await seed(db.mockDb, db.runner);

    expect(await counts(db.pg)).toEqual({ etfs: 3, fieldCatalog: 8, trackedFields: 6, settings: 1 });

    const etfs = await db.pg.query<{ symbol: string; adapter_key: string; is_active: boolean }>(
      'select "symbol", "adapter_key", "is_active" from "etfs" order by "symbol"',
    );
    expect(etfs.rows.map((r) => r.symbol)).toEqual([...seedEtfs].map((e) => e.symbol).sort());
    for (const row of etfs.rows) {
      expect(row.adapter_key).toBe("brd-depositary");
      expect(row.is_active).toBe(true);
    }

    const settings = await db.pg.query<{ default_locale: string }>('select "default_locale" from "settings"');
    expect(settings.rows[0].default_locale).toBe("ro");

    await db.close();
  }, 20_000);

  it("SD-2: seeding twice on an empty database gives the same counts and rows", async () => {
    const db = await createEmptyTestDatabase();
    await seed(db.mockDb, db.runner);
    await seed(db.mockDb, db.runner);

    expect(await counts(db.pg)).toEqual({ etfs: 3, fieldCatalog: 8, trackedFields: 6, settings: 1 });
    await db.close();
  }, 20_000);

  it("SD-3: admin changes survive a re-seed, and a deleted tracked field never comes back", async () => {
    const db = await createEmptyTestDatabase();
    await seed(db.mockDb, db.runner);

    const oneSymbol = seedEtfs[0].symbol;
    await db.pg.query('update "etfs" set "name" = $1 where "symbol" = $2', ["Renamed by admin", oneSymbol]);

    const otherSymbol = seedEtfs[1].symbol;
    await db.pg.query('update "etfs" set "is_active" = false where "symbol" = $1', [otherSymbol]);

    const thirdSymbol = seedEtfs[2].symbol;
    await db.pg.query('update "etfs" set "adapter_key" = null where "symbol" = $1', [thirdSymbol]);

    const oneEtfId = (
      await db.pg.query<{ id: number }>('select "id" from "etfs" where "symbol" = $1', [oneSymbol])
    ).rows[0].id;
    const deletedFieldKey = seedTrackedFields[0].fieldKey;
    await db.pg.query('delete from "tracked_fields" where "etf_id" = $1 and "field_key" = $2', [
      oneEtfId,
      deletedFieldKey,
    ]);
    const remainingFieldKey = seedTrackedFields[1].fieldKey;
    await db.pg.query('update "tracked_fields" set "display_order" = 9 where "etf_id" = $1 and "field_key" = $2', [
      oneEtfId,
      remainingFieldKey,
    ]);

    await db.pg.query("update \"settings\" set \"default_locale\" = 'en'");

    await seed(db.mockDb, db.runner);

    expect(await counts(db.pg)).toEqual({ etfs: 3, fieldCatalog: 8, trackedFields: 5, settings: 1 });

    const renamed = await db.pg.query<{ name: string }>('select "name" from "etfs" where "symbol" = $1', [oneSymbol]);
    expect(renamed.rows[0].name).toBe("Renamed by admin");

    const deactivated = await db.pg.query<{ is_active: boolean }>(
      'select "is_active" from "etfs" where "symbol" = $1',
      [otherSymbol],
    );
    expect(deactivated.rows[0].is_active).toBe(false);

    const cleared = await db.pg.query<{ adapter_key: string | null }>(
      'select "adapter_key" from "etfs" where "symbol" = $1',
      [thirdSymbol],
    );
    expect(cleared.rows[0].adapter_key).toBeNull();

    const trackedFieldKeys = (
      await db.pg.query<{ field_key: string }>('select "field_key" from "tracked_fields" where "etf_id" = $1', [
        oneEtfId,
      ])
    ).rows.map((r) => r.field_key);
    expect(trackedFieldKeys).not.toContain(deletedFieldKey);
    expect(trackedFieldKeys).toContain(remainingFieldKey);

    const displayOrder = await db.pg.query<{ display_order: number }>(
      'select "display_order" from "tracked_fields" where "etf_id" = $1 and "field_key" = $2',
      [oneEtfId, remainingFieldKey],
    );
    expect(displayOrder.rows[0].display_order).toBe(9);

    const settingsRow = await db.pg.query<{ default_locale: string }>('select "default_locale" from "settings"');
    expect(settingsRow.rows[0].default_locale).toBe("en");

    await db.close();
  }, 20_000);

  it("SD-4: a catalogue label changed in seed-data.ts is refreshed by a re-run", async () => {
    const db = await createEmptyTestDatabase();
    await seed(db.mockDb, db.runner);

    const target = seedFieldCatalog[0];
    await db.pg.query('update "field_catalog" set "label_en" = $1 where "adapter_key" = $2 and "field_key" = $3', [
      "stale",
      target.adapterKey,
      target.fieldKey,
    ]);

    await seed(db.mockDb, db.runner);

    const refreshed = await db.pg.query<{ label_en: string }>(
      'select "label_en" from "field_catalog" where "adapter_key" = $1 and "field_key" = $2',
      [target.adapterKey, target.fieldKey],
    );
    expect(refreshed.rows[0].label_en).toBe(target.labelEn);

    await db.close();
  }, 20_000);

  it("SD-5: a symbol already present before the first seed keeps its name and gets no tracked field inserted", async () => {
    const db = await createEmptyTestDatabase();
    const preExisting = seedEtfs[0];
    await db.pg.query('insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key") values ($1, $2, $3, $4)', [
      preExisting.symbol,
      "Added via /admin before first seed",
      preExisting.bvbUrl,
      null,
    ]);

    await seed(db.mockDb, db.runner);

    const row = await db.pg.query<{ name: string; id: number }>(
      'select "id", "name" from "etfs" where "symbol" = $1',
      [preExisting.symbol],
    );
    expect(row.rows[0].name).toBe("Added via /admin before first seed");

    const tracked = await db.pg.query('select * from "tracked_fields" where "etf_id" = $1', [row.rows[0].id]);
    expect(tracked.rows).toHaveLength(0);

    await db.close();
  }, 20_000);

  it("SD-6: seed performs exactly one BatchRunner call", async () => {
    const db = await createEmptyTestDatabase();
    const spy = vi.fn(db.runner);
    await seed(db.mockDb, spy);
    expect(spy).toHaveBeenCalledTimes(1);
    await db.close();
  }, 20_000);

  it("builds a non-empty statement list", () => {
    const db = { execute: (q: unknown) => q } as unknown as Parameters<typeof buildSeedStatements>[0];
    expect(buildSeedStatements(db).length).toBeGreaterThan(0);
  });
});
