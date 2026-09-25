import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDrizzleReportStore } from "../ingestion/store";
import { createTestDatabase, type TestDatabase } from "../../test/helpers/pglite";
import { createHomeTableLoader } from "./home";

let db: TestDatabase;

beforeEach(async () => {
  db = await createTestDatabase();
}, 60_000);

afterEach(async () => {
  await db.close();
});

async function insertEtf(symbol: string, adapterKey: string | null, isActive = true) {
  const result = await db.pg.query<{ id: number }>(
    `insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key", "is_active") values ($1, $2, $3, $4, $5) returning "id"`,
    [symbol, `${symbol} name`, `https://bvb.ro/${symbol}`, adapterKey, isActive],
  );
  return result.rows[0].id;
}

async function trackField(etfId: number, fieldKey: string, displayOrder: number) {
  await db.pg.query(
    `insert into "tracked_fields" ("etf_id", "field_key", "display_order") values ($1, $2, $3)`,
    [etfId, fieldKey, displayOrder],
  );
}

async function insertCatalog(adapterKey: string, fieldKey: string, labelRo: string, labelEn: string) {
  await db.pg.query(
    `insert into "field_catalog" ("adapter_key", "field_key", "label_ro", "label_en") values ($1, $2, $3, $4)`,
    [adapterKey, fieldKey, labelRo, labelEn],
  );
}

function loader() {
  return createHomeTableLoader(db.mockDb, undefined, db.runner);
}

describe("createHomeTableLoader executed on PGlite", () => {
  it("AC1: one row per active ETF ordered by symbol; inactive excluded; no-report and null-adapter ETFs still get a row", async () => {
    await insertEtf("ZZZETF", null);
    await insertEtf("AAAETF", "brd-depositary", false); // inactive, excluded

    const rows = (await loader()()).rows;
    expect(rows.map((r) => r.symbol)).toEqual(["BTBETRETF", "ZZZETF"]);

    const zzz = rows.find((r) => r.symbol === "ZZZETF")!;
    expect(zzz.valueDate).toBeNull();
    expect(zzz.latestPdfUrl).toBeNull();
    expect(zzz.adapterAvailable).toBe(false);
  });

  it("AC2: a tracked_fields row adds a column at its display_order; deleting it removes the column, no code change", async () => {
    await insertCatalog("brd-depositary", "nav_per_unit", "VUAN", "NAV per unit");
    await trackField(db.etfId, "nav_per_unit", 0);

    const before = await loader()();
    expect(before.columns.map((c) => c.fieldKey)).toEqual(["nav_per_unit"]);
    expect(before.columns[0]).toEqual({ fieldKey: "nav_per_unit", labelRo: "VUAN", labelEn: "NAV per unit" });

    await db.pg.query('delete from "tracked_fields" where "field_key" = $1', ["nav_per_unit"]);
    const after = await loader()();
    expect(after.columns).toEqual([]);
  });

  it("AC2: columns are ordered by the lowest display_order any ETF gives the field, then field_key", async () => {
    const other = await insertEtf("ZZZETF", "brd-depositary");
    await trackField(db.etfId, "b_field", 5);
    await trackField(other, "b_field", 1); // lower display_order wins the tie-break position
    await trackField(db.etfId, "a_field", 5);

    const { columns } = await loader()();
    expect(columns.map((c) => c.fieldKey)).toEqual(["b_field", "a_field"]);
  });

  it("AC2: an untracked field is {tracked:false}, distinguishable from tracked-with-no-value", async () => {
    const other = await insertEtf("ZZZETF", "brd-depositary");
    await trackField(other, "only_other_tracks", 0);

    const { rows } = await loader()();
    const btb = rows.find((r) => r.symbol === "BTBETRETF")!;
    expect(btb.cells.only_other_tracks).toEqual({ tracked: false });
  });

  it("AC2: header falls back to the field_key when no field_catalog entry exists", async () => {
    await trackField(db.etfId, "no_catalog_entry", 0);
    const { columns } = await loader()();
    expect(columns[0]).toEqual({ fieldKey: "no_catalog_entry", labelRo: "no_catalog_entry", labelEn: "no_catalog_entry" });
  });

  it("AC2: label tie-break picks the alphabetically first adapter_key when two adapters define the same field_key", async () => {
    await insertCatalog("z-adapter", "shared_field", "Z label ro", "Z label en");
    await insertCatalog("a-adapter", "shared_field", "A label ro", "A label en");
    await trackField(db.etfId, "shared_field", 0);

    const { columns } = await loader()();
    expect(columns[0]).toEqual({ fieldKey: "shared_field", labelRo: "A label ro", labelEn: "A label en" });
  });

  it("AC3: a tracked cell shows the newest ok report's value and date; missing field is empty, never from an older report", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    await trackField(db.etfId, "units_in_circulation", 1);
    const store = createDrizzleReportStore(db.mockDb, db.runner);

    await store.saveReport({
      etfId: db.etfId,
      reportDate: "2026-09-20",
      sourceUrl: "https://bvb.ro/old.pdf",
      fetchedAt: new Date("2026-09-20T09:00:00Z"),
      status: "ok",
      errorMessage: null,
      values: [
        { fieldKey: "nav_per_unit", numericValue: "10.000", rawValue: "10.000" },
        { fieldKey: "units_in_circulation", numericValue: "5000000", rawValue: "5.000.000" },
      ],
    });
    await store.saveReport({
      etfId: db.etfId,
      reportDate: "2026-09-22",
      sourceUrl: "https://bvb.ro/new.pdf",
      fetchedAt: new Date("2026-09-22T09:00:00Z"),
      status: "ok",
      errorMessage: null,
      // units_in_circulation missing from the newest ok report on purpose
      values: [{ fieldKey: "nav_per_unit", numericValue: "11.171", rawValue: "11.171" }],
    });

    const { rows } = await loader()();
    const row = rows.find((r) => r.symbol === "BTBETRETF")!;
    expect(row.valueDate).toBe("2026-09-22");
    expect(row.cells.nav_per_unit).toEqual({ tracked: true, value: "11.171", delta: null });
    expect(row.cells.units_in_circulation).toEqual({ tracked: true, value: null, delta: null });
  });

  it("AC3: an ETF with no ok report has empty value cells and no date", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    const { rows } = await loader()();
    const row = rows.find((r) => r.symbol === "BTBETRETF")!;
    expect(row.valueDate).toBeNull();
    expect(row.cells.nav_per_unit).toEqual({ tracked: true, value: null, delta: null });
  });

  it("AC3/decision 2: a newer parse_error row, even with stored values, changes no value and no date", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    const store = createDrizzleReportStore(db.mockDb, db.runner);

    await store.saveReport({
      etfId: db.etfId,
      reportDate: "2026-09-20",
      sourceUrl: "https://bvb.ro/ok.pdf",
      fetchedAt: new Date("2026-09-20T09:00:00Z"),
      status: "ok",
      errorMessage: null,
      values: [{ fieldKey: "nav_per_unit", numericValue: "10.000", rawValue: "10.000" }],
    });
    await store.saveReport({
      etfId: db.etfId,
      reportDate: "2026-09-22",
      sourceUrl: "https://bvb.ro/broken.pdf",
      fetchedAt: new Date("2026-09-22T09:00:00Z"),
      status: "parse_error",
      errorMessage: "boom",
      values: [{ fieldKey: "nav_per_unit", numericValue: "999", rawValue: "999" }],
    });

    const { rows } = await loader()();
    const row = rows.find((r) => r.symbol === "BTBETRETF")!;
    expect(row.valueDate).toBe("2026-09-20");
    expect(row.cells.nav_per_unit).toEqual({ tracked: true, value: "10.000", delta: null });
  });

  it("AC4: the symbol links to the newest report's source_url regardless of status; a newer parse_error link wins over an older ok link", async () => {
    const store = createDrizzleReportStore(db.mockDb, db.runner);
    await store.saveReport({
      etfId: db.etfId,
      reportDate: "2026-09-20",
      sourceUrl: "https://bvb.ro/ok.pdf",
      fetchedAt: new Date("2026-09-20T09:00:00Z"),
      status: "ok",
      errorMessage: null,
      values: [],
    });
    await store.saveReport({
      etfId: db.etfId,
      reportDate: "2026-09-22",
      sourceUrl: "https://bvb.ro/broken.pdf",
      fetchedAt: new Date("2026-09-22T09:00:00Z"),
      status: "parse_error",
      errorMessage: "boom",
      values: [],
    });

    const { rows } = await loader()();
    const row = rows.find((r) => r.symbol === "BTBETRETF")!;
    expect(row.latestPdfUrl).toBe("https://bvb.ro/broken.pdf");
  });

  it("AC4: an ETF with no report row of any kind has no link", async () => {
    const { rows } = await loader()();
    const row = rows.find((r) => r.symbol === "BTBETRETF")!;
    expect(row.latestPdfUrl).toBeNull();
  });

  it("AC5: adapterAvailable is false for a NULL adapter_key and for a key not in the registry, true for a registered key", async () => {
    const nullAdapter = await insertEtf("NULLETF", null);
    const unknownAdapter = await insertEtf("UNKETF", "totally-unknown-adapter");

    const { rows } = await loader()();
    const btb = rows.find((r) => r.symbol === "BTBETRETF")!; // seeded with "brd-depositary", a registered key
    const nullRow = rows.find((r) => r.symbol === "NULLETF")!;
    const unkRow = rows.find((r) => r.symbol === "UNKETF")!;

    expect(btb.adapterAvailable).toBe(true);
    expect(nullRow.adapterAvailable).toBe(false);
    expect(unkRow.adapterAvailable).toBe(false);
    expect(nullAdapter).toBeGreaterThan(0); // ids used, silences unused-var lint
    expect(unknownAdapter).toBeGreaterThan(0);
  });
});
