import { sql } from "drizzle-orm";
import type { Db } from "../db/index";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import type { AdapterRegistry } from "../extraction/adapters/types";
import { neonBatchRunner, rowsOf, type BatchRunner } from "../ingestion/store";
import { computeDelta, isCanonicalDecimal, previousCalendarDay, type Delta } from "./delta";

/** A column the table shows, one per tracked `field_key` across all active ETFs (US-016 AC2, decision 3). */
export type HomeColumn = {
  fieldKey: string;
  labelRo: string;
  labelEn: string;
};

/**
 * A cell distinguishes "this ETF does not track this field" from "tracked but no value yet"
 * (AC2). `delta` (US-017) is `null` whenever there is no exact previous-day comparison to show —
 * never a guessed `0` (AGENTS.md "Never guess a value").
 */
export type HomeCell = { tracked: false } | { tracked: true; value: string | null; delta: Delta | null };

export type HomeRow = {
  symbol: string;
  /** `adapter_key` is set AND registered in the default adapter registry (AC5). */
  adapterAvailable: boolean;
  /** `source_url` of the newest report row of any status that has one (AC4). Never built from the symbol/date. */
  latestPdfUrl: string | null;
  /** `report_date` of the newest `ok` report, or `null` if the ETF has none (AC3). */
  valueDate: string | null;
  /** Keyed by `fieldKey`, one entry per column. */
  cells: Record<string, HomeCell>;
};

export type HomeTableViewModel = {
  columns: readonly HomeColumn[];
  rows: readonly HomeRow[];
};

/**
 * Active ETFs with their tracked field keys and each field's `display_order` for that ETF
 * (US-012's tie-break pattern, `load-etfs.ts`). Column order (AC2/decision 3) needs the
 * per-ETF `display_order`, not just the field key, so it is selected here rather than reused
 * from `load-etfs.ts`'s statement.
 */
export function buildActiveEtfsStatement(db: Db) {
  return db.execute(
    sql`select "e"."id", "e"."symbol", "e"."adapter_key", "t"."field_key", "t"."display_order"
        from "etfs" "e" left join "tracked_fields" "t" on "t"."etf_id" = "e"."id"
        where "e"."is_active" = true
        order by "e"."symbol", "e"."id", "t"."display_order", "t"."field_key"`,
  );
}

/**
 * Every catalogue label, ordered so that the first row per `field_key` is the alphabetically
 * first `adapter_key` that defines it (decision 3's tie-break when two adapters share a key).
 */
export function buildFieldCatalogStatement(db: Db) {
  return db.execute(
    sql`select "field_key", "adapter_key", "label_ro", "label_en"
        from "field_catalog"
        order by "field_key", "adapter_key"`,
  );
}

/**
 * The newest `ok` report per ETF (decision 1, US-016). Shared by
 * `buildLatestOkValuesStatement` and `buildPreviousDayOkValuesStatement` (US-017 plan §4.1,
 * R4) so the two statements can never disagree on what "newest `ok` report" means.
 */
const LATEST_OK_REPORT_FRAGMENT = sql`(
  select distinct on ("r"."etf_id") "r"."etf_id", "r"."id" as "report_id", "r"."report_date"
  from "reports" "r"
  where "r"."status" = 'ok'
  order by "r"."etf_id", "r"."report_date" desc, "r"."id" desc
)`;

/**
 * The newest `ok` report per ETF (decision 1) and its values, left-joined so an `ok` report
 * with zero `report_values` rows still yields a row carrying `report_date` (AC3's "row shows
 * that report's date" even if a value is missing). A newer `parse_error` row is invisible
 * here regardless of its own values (decision 2).
 */
export function buildLatestOkValuesStatement(db: Db) {
  return db.execute(
    sql`select "latest"."etf_id", "latest"."report_date", "rv"."field_key", "rv"."numeric_value"
        from ${LATEST_OK_REPORT_FRAGMENT} "latest"
        left join "report_values" "rv" on "rv"."report_id" = "latest"."report_id"
        order by "latest"."etf_id", "rv"."field_key"`,
  );
}

/**
 * The `ok` report exactly one calendar day before each ETF's newest `ok` report, and its values
 * (US-017 AC3/AC4, plan §4.1 option (a)). `date - integer` is a `date` in Postgres, so month/year
 * boundaries are handled natively, with no time zone. A missing previous-day report, a
 * `parse_error` one, or one without the field all simply yield no row here — the read model
 * turns "no row" into `delta: null`, never a guess.
 */
export function buildPreviousDayOkValuesStatement(db: Db) {
  return db.execute(
    sql`select "latest"."etf_id", "prev"."report_date" as "previous_date", "rv"."field_key", "rv"."numeric_value"
        from ${LATEST_OK_REPORT_FRAGMENT} "latest"
        join "reports" "prev" on "prev"."etf_id" = "latest"."etf_id"
                              and "prev"."report_date" = "latest"."report_date" - 1
                              and "prev"."status" = 'ok'
        join "report_values" "rv" on "rv"."report_id" = "prev"."id"
        order by "latest"."etf_id", "rv"."field_key"`,
  );
}

/**
 * The newest report row per ETF that has a `source_url`, of any status (AC4 — "whatever its
 * status": the symbol always links to the newest PDF, independent of the values shown).
 */
export function buildLatestReportLinksStatement(db: Db) {
  return db.execute(
    sql`select distinct on ("r"."etf_id") "r"."etf_id", "r"."source_url"
        from "reports" "r"
        where "r"."source_url" is not null
        order by "r"."etf_id", "r"."report_date" desc, "r"."id" desc`,
  );
}

function parseColumns(
  etfRows: readonly Record<string, unknown>[],
  catalogRows: readonly Record<string, unknown>[],
): HomeColumn[] {
  const minDisplayOrder = new Map<string, number>();
  for (const row of etfRows) {
    if (row.field_key === null || row.field_key === undefined) continue;
    const fieldKey = String(row.field_key);
    const displayOrder = Number(row.display_order);
    const current = minDisplayOrder.get(fieldKey);
    if (current === undefined || displayOrder < current) {
      minDisplayOrder.set(fieldKey, displayOrder);
    }
  }

  const labelByFieldKey = new Map<string, { labelRo: string; labelEn: string }>();
  for (const row of catalogRows) {
    const fieldKey = String(row.field_key);
    if (!labelByFieldKey.has(fieldKey)) {
      labelByFieldKey.set(fieldKey, { labelRo: String(row.label_ro), labelEn: String(row.label_en) });
    }
  }

  return [...minDisplayOrder.keys()]
    .sort((a, b) => {
      const orderA = minDisplayOrder.get(a)!;
      const orderB = minDisplayOrder.get(b)!;
      return orderA !== orderB ? orderA - orderB : a.localeCompare(b);
    })
    .map((fieldKey) => {
      const label = labelByFieldKey.get(fieldKey);
      return { fieldKey, labelRo: label?.labelRo ?? fieldKey, labelEn: label?.labelEn ?? fieldKey };
    });
}

type EtfAgg = { id: number; symbol: string; adapterKey: string | null; trackedFieldKeys: Set<string> };

function parseEtfs(etfRows: readonly Record<string, unknown>[]): { order: number[]; byId: Map<number, EtfAgg> } {
  const order: number[] = [];
  const byId = new Map<number, EtfAgg>();
  for (const row of etfRows) {
    const id = Number(row.id);
    let etf = byId.get(id);
    if (!etf) {
      etf = {
        id,
        symbol: String(row.symbol),
        adapterKey: row.adapter_key === null ? null : String(row.adapter_key),
        trackedFieldKeys: new Set(),
      };
      byId.set(id, etf);
      order.push(id);
    }
    if (row.field_key !== null && row.field_key !== undefined) {
      etf.trackedFieldKeys.add(String(row.field_key));
    }
  }
  return { order, byId };
}

/**
 * `reports.report_date` is a `date` column. Neon's HTTP driver returns it as a plain
 * `YYYY-MM-DD` string (JSON-based, no client-side type parsing), but PGlite/node-postgres's
 * wire-protocol driver parses it into a JS `Date` at UTC midnight — `String(date)` would then
 * print it in the *process*'s local time zone, silently shifting the day (the exact trap AC7
 * warns about for `formatReportDate`, one layer earlier). Reading it back with UTC getters
 * recovers the original calendar date regardless of the process time zone or which driver ran.
 */
function toIsoDateString(value: unknown): string {
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value);
}

type ValueAgg = { reportDate: string; values: Map<string, string | null> };

function parseValues(valueRows: readonly Record<string, unknown>[]): Map<number, ValueAgg> {
  const byEtf = new Map<number, ValueAgg>();
  for (const row of valueRows) {
    const etfId = Number(row.etf_id);
    let agg = byEtf.get(etfId);
    if (!agg) {
      agg = { reportDate: toIsoDateString(row.report_date), values: new Map() };
      byEtf.set(etfId, agg);
    }
    if (row.field_key !== null && row.field_key !== undefined) {
      agg.values.set(String(row.field_key), row.numeric_value === null ? null : String(row.numeric_value));
    }
  }
  return byEtf;
}

type PreviousAgg = { previousDate: string; values: Map<string, string | null> };

function parsePreviousValues(previousRows: readonly Record<string, unknown>[]): Map<number, PreviousAgg> {
  const byEtf = new Map<number, PreviousAgg>();
  for (const row of previousRows) {
    const etfId = Number(row.etf_id);
    let agg = byEtf.get(etfId);
    if (!agg) {
      agg = { previousDate: toIsoDateString(row.previous_date), values: new Map() };
      byEtf.set(etfId, agg);
    }
    if (row.field_key !== null && row.field_key !== undefined) {
      agg.values.set(String(row.field_key), row.numeric_value === null ? null : String(row.numeric_value));
    }
  }
  return byEtf;
}

/**
 * `null` unless there is an exact, well-formed previous-day comparison to show (US-017 AC4).
 * The date invariant (`previous_date` from SQL matches `previousCalendarDay(valueDate)`) keeps
 * `previousCalendarDay` on the production path (plan §4.1): a disagreement yields a blank
 * delta, never a wrong one.
 */
function computeCellDelta(
  valueDate: string | null,
  value: string | null,
  previousAgg: PreviousAgg | undefined,
  fieldKey: string,
): Delta | null {
  if (valueDate === null || value === null || !isCanonicalDecimal(value) || previousAgg === undefined) {
    return null;
  }
  if (previousAgg.previousDate !== previousCalendarDay(valueDate)) {
    return null;
  }
  const previousValue = previousAgg.values.get(fieldKey);
  if (previousValue === null || previousValue === undefined || !isCanonicalDecimal(previousValue)) {
    return null;
  }
  return computeDelta(value, previousValue);
}

function parseLinks(linkRows: readonly Record<string, unknown>[]): Map<number, string> {
  const byEtf = new Map<number, string>();
  for (const row of linkRows) {
    byEtf.set(Number(row.etf_id), String(row.source_url));
  }
  return byEtf;
}

function buildViewModel(
  etfRows: readonly Record<string, unknown>[],
  catalogRows: readonly Record<string, unknown>[],
  valueRows: readonly Record<string, unknown>[],
  previousRows: readonly Record<string, unknown>[],
  linkRows: readonly Record<string, unknown>[],
  registry: AdapterRegistry,
): HomeTableViewModel {
  const columns = parseColumns(etfRows, catalogRows);
  const { order, byId } = parseEtfs(etfRows);
  const valuesByEtf = parseValues(valueRows);
  const previousByEtf = parsePreviousValues(previousRows);
  const linksByEtf = parseLinks(linkRows);

  const rows: HomeRow[] = order.map((id) => {
    const etf = byId.get(id)!;
    const valueAgg = valuesByEtf.get(id);
    const previousAgg = previousByEtf.get(id);
    const valueDate = valueAgg?.reportDate ?? null;
    const cells: Record<string, HomeCell> = {};
    for (const column of columns) {
      if (!etf.trackedFieldKeys.has(column.fieldKey)) {
        cells[column.fieldKey] = { tracked: false };
        continue;
      }
      const value = valueAgg?.values.get(column.fieldKey) ?? null;
      cells[column.fieldKey] = {
        tracked: true,
        value,
        delta: computeCellDelta(valueDate, value, previousAgg, column.fieldKey),
      };
    }
    return {
      symbol: etf.symbol,
      adapterAvailable: etf.adapterKey !== null && registry.get(etf.adapterKey) !== undefined,
      latestPdfUrl: linksByEtf.get(id) ?? null,
      valueDate,
      cells,
    };
  });

  return { columns, rows };
}

/**
 * Loads the home table's view model in one batch of five read-only statements (AC1-AC5, plus
 * US-017's previous-day statement). Like `lib/ingestion/load-etfs.ts`, the injected `run` lets
 * PGlite tests execute the shipped statements instead of a re-implementation.
 */
export function createHomeTableLoader(
  db: Db,
  registry: AdapterRegistry = defaultAdapterRegistry,
  run: BatchRunner = neonBatchRunner(db),
): () => Promise<HomeTableViewModel> {
  return async () => {
    const [etfResult, catalogResult, valueResult, previousResult, linkResult] = await run([
      buildActiveEtfsStatement(db),
      buildFieldCatalogStatement(db),
      buildLatestOkValuesStatement(db),
      buildPreviousDayOkValuesStatement(db),
      buildLatestReportLinksStatement(db),
    ]);
    return buildViewModel(
      rowsOf(etfResult),
      rowsOf(catalogResult),
      rowsOf(valueResult),
      rowsOf(previousResult),
      rowsOf(linkResult),
      registry,
    );
  };
}
