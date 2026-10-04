import { sql } from "drizzle-orm";
import type { Db } from "../db/index";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import type { AdapterRegistry } from "../extraction/adapters/types";
import { neonBatchRunner, rowsOf, type BatchRunner } from "../ingestion/store";
import { logLoadError } from "../log/load-error";
import type { WidgetDefinition } from "../config/widgets";
import { evaluateWidget, type WidgetEvaluation, type WidgetReport } from "./widget-engine";

/** One tracked field's column (US-018 AC3), labelled from the ETF's own `adapter_key` (R4). */
export type HistoryField = { fieldKey: string; labelRo: string; labelEn: string };

/** One `ok` report's date and its tracked values, keyed by `fieldKey` (AC3, AC4). */
export type HistoryRow = { reportDate: string; values: Record<string, string | null> };

export type EtfHistory = {
  etf: { symbol: string; name: string; isActive: boolean; adapterAvailable: boolean };
  fields: readonly HistoryField[];
  rows: readonly HistoryRow[];
  widgets: readonly WidgetView[];
};

export type WidgetView = {
  slot: number;
  definition: WidgetDefinition;
  labelRo: string;
  labelEn: string;
  evaluation: WidgetEvaluation;
};

export function buildHistoryWidgetsStatement(db: Db, symbol: string) {
  return db.execute(
    sql`select "w"."slot", "w"."operation", "w"."field_key", "w"."period_unit",
          "w"."period_amount", "w"."title", "fc"."label_ro", "fc"."label_en",
          to_char("r"."report_date", 'YYYY-MM-DD') as "report_date", "rv"."numeric_value"
        from "etfs" "e"
        join "etf_widgets" "w" on "w"."etf_id" = "e"."id"
        left join "field_catalog" "fc" on "fc"."adapter_key" = "e"."adapter_key"
          and "fc"."field_key" = "w"."field_key"
        left join "reports" "r" on "r"."etf_id" = "e"."id" and "r"."status" = 'ok'
        left join "report_values" "rv" on "rv"."report_id" = "r"."id"
          and "rv"."field_key" = "w"."field_key"
        where "e"."symbol" = ${symbol}
        order by "w"."slot", "r"."report_date" desc, "r"."id" desc`,
  );
}

function parseWidgetViews(
  rows: readonly Record<string, unknown>[],
  adapterKey: string | null,
  registry: AdapterRegistry,
): WidgetView[] {
  const available = new Set(registry.get(adapterKey)?.fieldKeys ?? []);
  const bySlot = new Map<number, { row: Record<string, unknown>; reports: WidgetReport[] }>();
  for (const row of rows) {
    const fieldKey = String(row.field_key);
    if (row.label_ro === null || row.label_en === null || !available.has(fieldKey)) continue;
    const slot = Number(row.slot);
    if (!bySlot.has(slot)) bySlot.set(slot, { row, reports: [] });
    if (row.report_date !== null) {
      bySlot.get(slot)!.reports.push({
        reportDate: String(row.report_date),
        status: "ok",
        values: { [fieldKey]: row.numeric_value === null ? null : String(row.numeric_value) },
      });
    }
  }
  return [...bySlot.entries()].map(([slot, { row, reports }]) => {
    const definition: WidgetDefinition = {
      operation: String(row.operation) as WidgetDefinition["operation"],
      fieldKey: String(row.field_key),
      periodUnit: String(row.period_unit) as WidgetDefinition["periodUnit"],
      periodAmount: Number(row.period_amount),
      ...(row.title === null ? {} : { title: String(row.title) }),
    };
    return {
      slot,
      definition,
      labelRo: String(row.label_ro),
      labelEn: String(row.label_en),
      evaluation: evaluateWidget(definition, reports),
    };
  });
}

/** `symbol` is always a bound parameter, never interpolated into SQL text (story Notes). */
export function buildHistoryEtfStatement(db: Db, symbol: string) {
  return db.execute(
    sql`select "e"."symbol", "e"."name", "e"."is_active", "e"."adapter_key"
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
 * Loads required history in one batch; optional widget data is a separate isolated read.
 * `null` when no ETF has this exact symbol (AC1). Like `createHomeTableLoader`, the injected
 * `run` lets PGlite tests execute the shipped statements instead of a re-implementation.
 */
export function createEtfHistoryLoader(
  db: Db,
  run: BatchRunner = neonBatchRunner(db),
  registry: AdapterRegistry = defaultAdapterRegistry,
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
    const adapterKey = etfRow.adapter_key === null || etfRow.adapter_key === undefined ? null : String(etfRow.adapter_key);
    let widgets: WidgetView[] = [];
    try {
      const [widgetResult] = await run([buildHistoryWidgetsStatement(db, symbol)]);
      widgets = parseWidgetViews(rowsOf(widgetResult), adapterKey, registry);
    } catch (error) {
      logLoadError("etf-detail-widgets", error);
    }
    return {
      etf: {
        symbol: String(etfRow.symbol),
        name: String(etfRow.name),
        isActive: Boolean(etfRow.is_active),
        adapterAvailable: adapterKey !== null && registry.get(adapterKey) !== undefined,
      },
      fields,
      rows: parseRows(rowsOf(rowResult), fields),
      widgets,
    };
  };
}
