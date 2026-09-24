import { sql } from "drizzle-orm";
import type { Db } from "../db/index";
import type { ExtractedValue } from "../extraction/adapters/types";

export type ReportRow = { id: number; status: string };

export type SaveReportInput = {
  etfId: number;
  reportDate: string;
  sourceUrl: string;
  fetchedAt: Date;
  status: "ok" | "parse_error";
  errorMessage: string | null;
  values: readonly ExtractedValue[];
};

export type SaveReportResult = { status: "written"; reportId: number } | { status: "already_ok" };

export interface ReportStore {
  findReport(etfId: number, reportDate: string): Promise<ReportRow | undefined>;
  saveReport(input: SaveReportInput): Promise<SaveReportResult>;
}

/**
 * Runs a list of statements atomically and returns one result per statement, in order.
 * `neonBatchRunner` is `db.batch`, a single Neon HTTP transaction. Tests may inject a PGlite
 * transaction runner instead, so the *shipped* statements (not a re-implementation) are what
 * gets executed offline.
 */
export type BatchRunner = (statements: readonly ReturnType<Db["execute"]>[]) => Promise<readonly unknown[]>;

export function neonBatchRunner(db: Db): BatchRunner {
  return (statements) => db.batch(statements as unknown as Parameters<Db["batch"]>[0]);
}

/** Normalises a per-statement batch result: neon-http returns row arrays directly; other executors may wrap them under `.rows`. */
export function rowsOf(result: unknown): readonly Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result as Record<string, unknown>[];
  }
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows: unknown }).rows;
    return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
  }
  return [];
}

export function buildFindReportStatement(db: Db, etfId: number, reportDate: string) {
  return db.execute(
    sql`select "id", "status" from "reports" where "etf_id" = ${etfId} and "report_date" = ${reportDate}`,
  );
}

/**
 * DEC-010 binding note 2, pattern (a) with (b)'s ordering: one `db.batch` for a report and its
 * values, so the write is a single Neon HTTP transaction. Every statement is guarded by
 * `status <> 'ok'`, so an already-`ok` row is left untouched (never downgraded — US-014's
 * rule, enforced here in SQL, not just by the caller). The status becomes `'ok'` only in the
 * final statement, after every value is written.
 */
export function buildSaveReportStatements(db: Db, input: SaveReportInput) {
  const { etfId, reportDate, sourceUrl, fetchedAt, status, errorMessage, values } = input;

  const claimReport = db.execute(
    sql`insert into "reports" ("etf_id", "report_date", "source_url", "fetched_at", "status", "error_message")
        values (${etfId}, ${reportDate}, ${sourceUrl}, ${fetchedAt}, 'parse_error', 'write in progress')
        on conflict ("etf_id", "report_date") do update set
          "source_url" = excluded."source_url",
          "fetched_at" = excluded."fetched_at",
          "status" = 'parse_error',
          "error_message" = 'write in progress'
        where "reports"."status" <> 'ok'`,
  );

  const clearOldValues = db.execute(
    sql`delete from "report_values" where "report_id" in (
          select "id" from "reports"
          where "etf_id" = ${etfId} and "report_date" = ${reportDate} and "status" <> 'ok'
        )`,
  );

  const insertValues = values.map((value) =>
    db.execute(
      sql`insert into "report_values" ("report_id", "field_key", "numeric_value", "raw_value")
          select "r"."id", ${value.fieldKey}::text, ${value.numericValue}::numeric, ${value.rawValue}::text
          from "reports" "r"
          where "r"."etf_id" = ${etfId} and "r"."report_date" = ${reportDate} and "r"."status" <> 'ok'`,
    ),
  );

  const finalizeReport = db.execute(
    sql`update "reports" set "status" = ${status}, "error_message" = ${errorMessage}
        where "etf_id" = ${etfId} and "report_date" = ${reportDate} and "status" <> 'ok'
        returning "id"`,
  );

  return [claimReport, clearOldValues, ...insertValues, finalizeReport] as const;
}

export function createDrizzleReportStore(db: Db, run: BatchRunner = neonBatchRunner(db)): ReportStore {
  return {
    async findReport(etfId, reportDate) {
      const [result] = await run([buildFindReportStatement(db, etfId, reportDate)]);
      const rows = rowsOf(result);
      if (rows.length === 0) {
        return undefined;
      }
      const row = rows[0];
      return { id: Number(row.id), status: String(row.status) };
    },
    async saveReport(input) {
      const statements = buildSaveReportStatements(db, input);
      const results = await run(statements);
      const finalResult = results[results.length - 1];
      const rows = rowsOf(finalResult);
      if (rows.length === 0) {
        return { status: "already_ok" };
      }
      return { status: "written", reportId: Number(rows[0].id) };
    },
  };
}
