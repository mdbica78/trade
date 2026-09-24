import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../test/helpers/pglite";
import { buildSaveReportStatements, createDrizzleReportStore } from "./store";

let db: TestDatabase;

beforeEach(async () => {
  db = await createTestDatabase();
}, 60_000);

afterEach(async () => {
  await db.close();
});

function input(overrides: Partial<Parameters<typeof buildSaveReportStatements>[1]> = {}) {
  return {
    etfId: db.etfId,
    reportDate: "2026-09-22",
    sourceUrl: "https://bvb.ro/example.pdf",
    fetchedAt: new Date("2026-09-22T09:00:00Z"),
    status: "ok" as const,
    errorMessage: null,
    values: [{ fieldKey: "nav_per_unit", numericValue: "11.171", rawValue: "11.171" }],
    ...overrides,
  };
}

describe("store executed on PGlite", () => {
  it(
    "PG-4b: a mid-batch failure inside a real transaction leaves no reports row and no report_values",
    async () => {
      const store = createDrizzleReportStore(db.mockDb, db.runner);
      await expect(
        store.saveReport(
          input({ values: [{ fieldKey: "nav_per_unit", numericValue: "not-a-number", rawValue: "x" }] }),
        ),
      ).rejects.toThrow();

      const reports = await db.pg.query('select * from "reports"');
      const values = await db.pg.query('select * from "report_values"');
      expect(reports.rows).toHaveLength(0);
      expect(values.rows).toHaveLength(0);
    },
    30_000,
  );

  it(
    "PG-4c: the same failing input through a non-atomic runner leaves a parse_error row, never ok",
    async () => {
      const store = createDrizzleReportStore(db.mockDb, db.nonAtomicRunner);
      await expect(
        store.saveReport(
          input({ values: [{ fieldKey: "nav_per_unit", numericValue: "not-a-number", rawValue: "x" }] }),
        ),
      ).rejects.toThrow();

      const reports = await db.pg.query<{ status: string }>('select "status" from "reports"');
      expect(reports.rows).toHaveLength(1);
      expect(reports.rows[0].status).toBe("parse_error");
    },
    30_000,
  );

  it(
    "PG-5a: an existing ok row is never overwritten by a later saveReport (the race guard)",
    async () => {
      const store = createDrizzleReportStore(db.mockDb, db.runner);
      const first = await store.saveReport(input());
      expect(first.status).toBe("written");

      const second = await store.saveReport(
        input({ values: [{ fieldKey: "nav_per_unit", numericValue: "99.999", rawValue: "99.999" }] }),
      );
      expect(second).toEqual({ status: "already_ok" });

      const values = await db.pg.query<{ numeric_value: string }>('select "numeric_value" from "report_values"');
      expect(values.rows).toHaveLength(1);
      expect(values.rows[0].numeric_value).toBe("11.171");
    },
    30_000,
  );

  it(
    "PG-5b: an existing parse_error row is fully replaced, old extra values are gone",
    async () => {
      const reportInsert = await db.pg.query<{ id: number }>(
        `insert into "reports" ("etf_id", "report_date", "source_url", "fetched_at", "status", "error_message")
         values ($1, $2, $3, $4, 'parse_error', 'old failure') returning "id"`,
        [db.etfId, "2026-09-22", "https://old.example/old.pdf", new Date().toISOString()],
      );
      const reportId = reportInsert.rows[0].id;
      await db.pg.query(
        `insert into "report_values" ("report_id", "field_key", "numeric_value", "raw_value") values ($1, $2, $3, $4)`,
        [reportId, "old_field", "1", "1"],
      );

      const store = createDrizzleReportStore(db.mockDb, db.runner);
      const result = await store.saveReport(input());
      expect(result.status).toBe("written");

      const reports = await db.pg.query<{ status: string; error_message: string | null; source_url: string }>(
        'select "status", "error_message", "source_url" from "reports"',
      );
      expect(reports.rows).toHaveLength(1);
      expect(reports.rows[0].status).toBe("ok");
      expect(reports.rows[0].error_message).toBeNull();
      expect(reports.rows[0].source_url).toBe("https://bvb.ro/example.pdf");

      const values = await db.pg.query<{ field_key: string }>('select "field_key" from "report_values"');
      expect(values.rows.map((r) => r.field_key)).toEqual(["nav_per_unit"]);
    },
    30_000,
  );
});
