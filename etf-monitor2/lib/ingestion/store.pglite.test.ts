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

  it(
    "PG-14a: saveReport with status parse_error and two values writes one parse_error row and both values",
    async () => {
      const store = createDrizzleReportStore(db.mockDb, db.runner);
      const result = await store.saveReport(
        input({
          status: "parse_error",
          errorMessage: "missing fields: nav_per_unit",
          values: [
            { fieldKey: "net_asset", numericValue: "100", rawValue: "100" },
            { fieldKey: "units_in_circulation", numericValue: "5", rawValue: "5" },
          ],
        }),
      );
      expect(result.status).toBe("written");

      const reports = await db.pg.query<{
        status: string;
        error_message: string | null;
        report_date: string;
        source_url: string;
        fetched_at: Date | null;
      }>('select "status", "error_message", "report_date"::text, "source_url", "fetched_at" from "reports"');
      expect(reports.rows).toHaveLength(1);
      expect(reports.rows[0].status).toBe("parse_error");
      expect(reports.rows[0].error_message).toBe("missing fields: nav_per_unit");
      expect(reports.rows[0].report_date).toBe("2026-09-22");
      expect(reports.rows[0].source_url).toBe("https://bvb.ro/example.pdf");
      expect(reports.rows[0].fetched_at).not.toBeNull();

      const values = await db.pg.query<{ field_key: string }>('select "field_key" from "report_values"');
      expect(values.rows.map((r) => r.field_key).sort()).toEqual(["net_asset", "units_in_circulation"]);
    },
    30_000,
  );

  it(
    "PG-14c: a parse_error save with zero values (contract violations) writes the row but no report_values",
    async () => {
      const store = createDrizzleReportStore(db.mockDb, db.runner);
      const result = await store.saveReport(
        input({ status: "parse_error", errorMessage: "contract violations: unknown_field(unknown_field)", values: [] }),
      );
      expect(result.status).toBe("written");

      const reports = await db.pg.query<{ status: string; error_message: string | null }>(
        'select "status", "error_message" from "reports"',
      );
      expect(reports.rows).toHaveLength(1);
      expect(reports.rows[0].status).toBe("parse_error");
      expect(reports.rows[0].error_message).toBe("contract violations: unknown_field(unknown_field)");
      const values = await db.pg.query('select * from "report_values"');
      expect(values.rows).toHaveLength(0);
    },
    30_000,
  );

  it(
    "PG-14d: an existing ok row survives a later parse_error save attempt with partial values (the SQL guard, not just the caller)",
    async () => {
      const store = createDrizzleReportStore(db.mockDb, db.runner);
      const first = await store.saveReport(input());
      expect(first.status).toBe("written");

      const second = await store.saveReport(
        input({
          status: "parse_error",
          errorMessage: "missing fields: nav_per_unit",
          values: [{ fieldKey: "net_asset", numericValue: "1", rawValue: "1" }],
        }),
      );
      expect(second).toEqual({ status: "already_ok" });

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

  it(
    "PG-14e: an existing ok row survives a later parse_error save with zero values (the delete must not touch the ok row's values)",
    async () => {
      const store = createDrizzleReportStore(db.mockDb, db.runner);
      const first = await store.saveReport(input());
      expect(first.status).toBe("written");

      const second = await store.saveReport(
        input({ status: "parse_error", errorMessage: "contract violations: uncovered_field(net_asset)", values: [] }),
      );
      expect(second).toEqual({ status: "already_ok" });

      const values = await db.pg.query<{ field_key: string }>('select "field_key" from "report_values"');
      expect(values.rows.map((r) => r.field_key)).toEqual(["nav_per_unit"]);
    },
    30_000,
  );

  it(
    "PG-14f: an existing parse_error row is replaced by a later parse_error save with new message and values",
    async () => {
      const store = createDrizzleReportStore(db.mockDb, db.runner);
      await store.saveReport(
        input({ status: "parse_error", errorMessage: "old", values: [{ fieldKey: "old_field", numericValue: "1", rawValue: "1" }] }),
      );

      const result = await store.saveReport(
        input({
          status: "parse_error",
          errorMessage: "missing fields: nav_per_unit",
          values: [{ fieldKey: "net_asset", numericValue: "2", rawValue: "2" }],
        }),
      );
      expect(result.status).toBe("written");

      const reports = await db.pg.query<{ status: string; error_message: string | null }>(
        'select "status", "error_message" from "reports"',
      );
      expect(reports.rows).toHaveLength(1);
      expect(reports.rows[0].status).toBe("parse_error");
      expect(reports.rows[0].error_message).toBe("missing fields: nav_per_unit");

      const values = await db.pg.query<{ field_key: string }>('select "field_key" from "report_values"');
      expect(values.rows.map((r) => r.field_key)).toEqual(["net_asset"]);
    },
    30_000,
  );
});
