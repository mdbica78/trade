import { sql } from "drizzle-orm";
import type { Db } from "../db/index";
import { neonBatchRunner, rowsOf, type BatchRunner } from "../ingestion/store";

/** One tracked field's column (US-018 AC3), labelled from the ETF's own `adapter_key` (R4). */
export type HistoryField = { fieldKey: string; labelRo: string; labelEn: string };

/** One `ok` report's date and its tracked values, keyed by `fieldKey` (AC3, AC4). */
export type HistoryRow = { reportDate: string; values: Record<string, string | null> };

export type EtfHistory = {
  etf: { symbol: string; name: string; isActive: boolean };
  fields: readonly HistoryField[];
  rows: readonly HistoryRow[];
};

/** `symbol` is always a bound parameter, never interpolated into SQL text (story Notes). */
export function buildHistoryEtfStatement(db: Db, symbol: string) {
  return db.execute(
    sql`select "e"."symbol", "e"."name", "e"."is_active"
        from "etfs" "e"
        where "e"."symbol" = ${symbol}`,
  );
}

/**
 * The ETF's tracked fields, labelled from its own `adapter_key` (AC3, R4 — the home table instead
 * uses the alphabetically first adapter across all ETFs; the two rules agree today because only
 * one adapter is registered). A missing catalogue row, or a `NULL adapter_key`, falls back to
 * `field_key` in TS.
 */
export function buildHistoryFieldsStatement(db: Db, symbol: string) {
  return db.execute(
    sql`select "t"."field_key", "fc"."label_ro", "fc"."label_en"
        from "etfs" "e"
        join "tracked_fields" "t" on "t"."etf_id" = "e"."id"
        left join "field_catalog" "fc" on "fc"."adapter_key" = "e"."adapter_key" and "fc"."field_key" = "t"."field_key"
        where "e"."symbol" = ${symbol}
        order by "t"."display_order", "t"."field_key"`,
  );
}

/**
 * `ok` reports only (AC5), newest first, restricted to the ETF's tracked fields in the join
 * condition (AC3 "never appears") so an untracked stored field is excluded in SQL, not just in
 * TS. `to_char` returns `text` on both drivers, avoiding the PGlite `Date`-parsing trap `home.ts`
 * works around with `toIsoDateString` (plan §4.1) — no time zone, no `DateStyle` dependency.
 */
export function buildHistoryRowsStatement(db: Db, symbol: string) {
  return db.execute(
    sql`select to_char("r"."report_date", 'YYYY-MM-DD') as "report_date", "rv"."field_key", "rv"."numeric_value"
        from "etfs" "e"
        join "reports" "r" on "r"."etf_id" = "e"."id" and "r"."status" = 'ok'
        left join "report_values" "rv" on "rv"."report_id" = "r"."id"
          and "rv"."field_key" in (select "t"."field_key" from "tracked_fields" "t" where "t"."etf_id" = "e"."id")
        where "e"."symbol" = ${symbol}
        order by "r"."report_date" desc, "r"."id" desc, "rv"."field_key"`,
  );
}

function parseFields(fieldRows: readonly Record<string, unknown>[]): HistoryField[] {
  return fieldRows.map((row) => {
    const fieldKey = String(row.field_key);
    return {
      fieldKey,
      labelRo: row.label_ro === null || row.label_ro === undefined ? fieldKey : String(row.label_ro),
      labelEn: row.label_en === null || row.label_en === undefined ? fieldKey : String(row.label_en),
    };
  });
}

function parseRows(rowRows: readonly Record<string, unknown>[], fields: readonly HistoryField[]): HistoryRow[] {
  const fieldKeys = new Set(fields.map((f) => f.fieldKey));
  const byDate = new Map<string, HistoryRow>();
  const order: string[] = [];

  for (const row of rowRows) {
    const reportDate = String(row.report_date);
    let entry = byDate.get(reportDate);
    if (!entry) {
      const values: Record<string, string | null> = {};
      for (const fieldKey of fieldKeys) {
        values[fieldKey] = null;
      }
      entry = { reportDate, values };
      byDate.set(reportDate, entry);
      order.push(reportDate);
    }
    const fieldKey = row.field_key === null || row.field_key === undefined ? null : String(row.field_key);
    // The SQL join already restricts to tracked fields; this guard is a second line of defense.
    if (fieldKey !== null && fieldKeys.has(fieldKey)) {
      entry.values[fieldKey] = row.numeric_value === null ? null : String(row.numeric_value);
    }
  }

  return order.map((reportDate) => byDate.get(reportDate)!);
}

/**
 * Loads one ETF's history in one batch of three read-only statements (AC1, AC3-AC5, AC7).
 * `null` when no ETF has this exact symbol (AC1). Like `createHomeTableLoader`, the injected
 * `run` lets PGlite tests execute the shipped statements instead of a re-implementation.
 */
export function createEtfHistoryLoader(
  db: Db,
  run: BatchRunner = neonBatchRunner(db),
): (symbol: string) => Promise<EtfHistory | null> {
  return async (symbol: string) => {
    const [etfResult, fieldResult, rowResult] = await run([
      buildHistoryEtfStatement(db, symbol),
      buildHistoryFieldsStatement(db, symbol),
      buildHistoryRowsStatement(db, symbol),
    ]);
    const etfRows = rowsOf(etfResult);
    if (etfRows.length === 0) {
      return null;
    }
    const etfRow = etfRows[0];
    const fields = parseFields(rowsOf(fieldResult));
    return {
      etf: { symbol: String(etfRow.symbol), name: String(etfRow.name), isActive: Boolean(etfRow.is_active) },
      fields,
      rows: parseRows(rowsOf(rowResult), fields),
    };
  };
}
