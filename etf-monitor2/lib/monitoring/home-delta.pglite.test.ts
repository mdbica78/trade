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

async function trackField(etfId: number, fieldKey: string, displayOrder: number) {
  await db.pg.query(
    `insert into "tracked_fields" ("etf_id", "field_key", "display_order") values ($1, $2, $3)`,
    [etfId, fieldKey, displayOrder],
  );
}

function loader() {
  return createHomeTableLoader(db.mockDb, undefined, db.runner);
}

async function ok(reportDate: string, values: { fieldKey: string; numericValue: string }[]) {
  const store = createDrizzleReportStore(db.mockDb, db.runner);
  await store.saveReport({
    etfId: db.etfId,
    reportDate,
    sourceUrl: `https://bvb.ro/${reportDate}.pdf`,
    fetchedAt: new Date(`${reportDate}T09:00:00Z`),
    status: "ok",
    errorMessage: null,
    values: values.map((v) => ({ ...v, rawValue: v.numericValue })),
  });
}

async function parseError(reportDate: string, values: { fieldKey: string; numericValue: string }[]) {
  const store = createDrizzleReportStore(db.mockDb, db.runner);
  await store.saveReport({
    etfId: db.etfId,
    reportDate,
    sourceUrl: `https://bvb.ro/${reportDate}.pdf`,
    fetchedAt: new Date(`${reportDate}T09:00:00Z`),
    status: "parse_error",
    errorMessage: "boom",
    values: values.map((v) => ({ ...v, rawValue: v.numericValue })),
  });
}

async function cellFor(fieldKey = "nav_per_unit") {
  const { rows } = await loader()();
  const row = rows.find((r) => r.symbol === "BTBETRETF")!;
  return row.cells[fieldKey];
}

describe("createHomeTableLoader delta (US-017 AC3/AC4), executed on PGlite", () => {
  it("AC3: month boundary, 2026-02-28 then 2026-03-01, gives an exact non-null delta", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    await ok("2026-02-28", [{ fieldKey: "nav_per_unit", numericValue: "10.000" }]);
    await ok("2026-03-01", [{ fieldKey: "nav_per_unit", numericValue: "10.500" }]);

    const cell = await cellFor();
    expect(cell).toEqual({ tracked: true, value: "10.500", delta: { absolute: "0.500", percent: "5.00" } });
  });

  it("AC3: year boundary, 2026-12-31 then 2027-01-01, gives an exact non-null delta", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    await ok("2026-12-31", [{ fieldKey: "nav_per_unit", numericValue: "100" }]);
    await ok("2027-01-01", [{ fieldKey: "nav_per_unit", numericValue: "101" }]);

    const cell = await cellFor();
    expect(cell).toEqual({ tracked: true, value: "101", delta: { absolute: "1", percent: "1.00" } });
  });

  it("AC3: leap-year boundary, 2028-02-29 then 2028-03-01, gives an exact non-null delta", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    await ok("2028-02-29", [{ fieldKey: "nav_per_unit", numericValue: "50" }]);
    await ok("2028-03-01", [{ fieldKey: "nav_per_unit", numericValue: "55" }]);

    const cell = await cellFor();
    expect(cell).toEqual({ tracked: true, value: "55", delta: { absolute: "5", percent: "10.00" } });
  });

  it("AC3 negative control: only 2026-02-27 stored before 2026-03-01 -> delta null (the gap is not exactly one day)", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    await ok("2026-02-27", [{ fieldKey: "nav_per_unit", numericValue: "10" }]);
    await ok("2026-03-01", [{ fieldKey: "nav_per_unit", numericValue: "12" }]);

    const cell = await cellFor();
    expect(cell).toEqual({ tracked: true, value: "12", delta: null });
  });

  it("AC4(i): a missing previous day (older ok report exists further back) gives delta null, value still present", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    await ok("2026-09-20", [{ fieldKey: "nav_per_unit", numericValue: "10" }]);
    await ok("2026-09-22", [{ fieldKey: "nav_per_unit", numericValue: "11" }]);

    const cell = await cellFor();
    expect(cell).toEqual({ tracked: true, value: "11", delta: null });
  });

  it("AC4(ii): the previous day's report is parse_error, even with a stored value for the field -> delta null", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    await parseError("2026-09-21", [{ fieldKey: "nav_per_unit", numericValue: "999" }]);
    await ok("2026-09-22", [{ fieldKey: "nav_per_unit", numericValue: "11" }]);

    const cell = await cellFor();
    expect(cell).toEqual({ tracked: true, value: "11", delta: null });
  });

  it("AC4(iii): the previous day's ok report has no value for this field (but has another) -> this field's delta is null, the other has one", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    await trackField(db.etfId, "units_in_circulation", 1);
    await ok("2026-09-21", [{ fieldKey: "units_in_circulation", numericValue: "5000000" }]);
    await ok("2026-09-22", [
      { fieldKey: "nav_per_unit", numericValue: "11" },
      { fieldKey: "units_in_circulation", numericValue: "5100000" },
    ]);

    const navCell = await cellFor("nav_per_unit");
    const unitsCell = await cellFor("units_in_circulation");
    expect(navCell).toEqual({ tracked: true, value: "11", delta: null });
    expect(unitsCell).toEqual({
      tracked: true,
      value: "5100000",
      delta: { absolute: "100000", percent: "2.00" },
    });
  });

  it("AC4(iv): the current value is null (missing from the newest ok report) -> delta null", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    await ok("2026-09-21", [{ fieldKey: "nav_per_unit", numericValue: "10" }]);
    await ok("2026-09-22", []); // newest ok report, but missing nav_per_unit

    const cell = await cellFor();
    expect(cell).toEqual({ tracked: true, value: null, delta: null });
  });

  it("AC4(v): consecutive ok days give the exact difference of the two stored values", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    await ok("2026-09-21", [{ fieldKey: "nav_per_unit", numericValue: "11.085" }]);
    await ok("2026-09-22", [{ fieldKey: "nav_per_unit", numericValue: "11.091" }]);

    const cell = await cellFor();
    expect(cell).toEqual({ tracked: true, value: "11.091", delta: { absolute: "0.006", percent: "0.05" } });
  });

  it("AC4(vi): a previous stored value of 0 gives an exact absolute delta and a null percent", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    await ok("2026-09-21", [{ fieldKey: "nav_per_unit", numericValue: "0" }]);
    await ok("2026-09-22", [{ fieldKey: "nav_per_unit", numericValue: "5" }]);

    const cell = await cellFor();
    expect(cell).toEqual({ tracked: true, value: "5", delta: { absolute: "5", percent: null } });
  });

  it("AC4(vii): a newer parse_error report is ignored, so the shown value (09-22) is compared with the day before it (09-21), not with 09-23", async () => {
    await trackField(db.etfId, "nav_per_unit", 0);
    await ok("2026-09-21", [{ fieldKey: "nav_per_unit", numericValue: "11.085" }]);
    await ok("2026-09-22", [{ fieldKey: "nav_per_unit", numericValue: "11.091" }]);
    await parseError("2026-09-23", [{ fieldKey: "nav_per_unit", numericValue: "999" }]);

    const cell = await cellFor();
    expect(cell).toEqual({ tracked: true, value: "11.091", delta: { absolute: "0.006", percent: "0.05" } });
  });
});
