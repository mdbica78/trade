import { getTableName, sql } from "drizzle-orm";
import type { Db } from "../db/index";
import { etfReportLinks } from "../db/schema";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import type { AdapterRegistry } from "../extraction/adapters/types";
import { parsePgBoolean } from "../ingestion/load-etfs";
import { neonBatchRunner, rowsOf, type BatchRunner } from "../ingestion/store";
import { describeLoadError, logLoadError } from "../log/load-error";
import { computeDelta, isCanonicalDecimal, type Delta } from "./delta";

/** A column the table shows, one per tracked `field_key` across all active ETFs (US-016 AC2, decision 3). */
export type HomeColumn = {
  fieldKey: string;
  labelRo: string;
  labelEn: string;
  showAbsolute?: boolean;
  showPercent?: boolean;
  showArrow?: boolean;
};

export type HomeDisplayPanelColumn = {
  fieldKey: string;
  labelRo: string;
  labelEn: string;
  visible: boolean;
  position: number | null;
  catalogueOrder: number;
  showAbsolute: boolean | null;
  showPercent: boolean | null;
  showArrow: boolean | null;
};

export type HomeDisplayPanelModel = {
  saved: boolean;
  showAbsolute: boolean;
  showPercent: boolean;
  showArrow: boolean;
  etfs: readonly { etfId: number; symbol: string; name: string; visible: boolean }[];
  columns: readonly HomeDisplayPanelColumn[];
};

/**
 * A cell distinguishes "this ETF does not track this field" from "tracked but no value yet"
 * (AC2). `delta` (US-017, per-field previous-available rule US-036 AC4/AC5) is `null` whenever
 * there is no exact previous comparison to show — never a guessed `0` (AGENTS.md "Never guess a
 * value"). `previousDate` is the report date the delta was computed against, for the cell's
 * `title` (US-036 AC6).
 */
export type HomeCellDelta = Delta & { previousDate: string };

export type HomeCell = { tracked: false } | { tracked: true; value: string | null; delta: HomeCellDelta | null };

export type HomeRow = {
  symbol: string;
  /** The ETF's display name (`etfs.name`, US-036 AC3). Falls back to the symbol if unset. */
  name: string;
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
  customization?: HomeDisplayPanelModel;
};

/**
 * Active ETFs with their tracked field keys and each field's `display_order` for that ETF
 * (US-012's tie-break pattern, `load-etfs.ts`). Column order (AC2/decision 3) needs the
 * per-ETF `display_order`, not just the field key, so it is selected here rather than reused
 * from `load-etfs.ts`'s statement.
 */
export function buildActiveEtfsStatement(db: Db) {
  return db.execute(
    sql`select "e"."id", "e"."symbol", "e"."name", "e"."adapter_key", "t"."field_key", "t"."display_order"
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
    sql`select "id", "field_key", "adapter_key", "label_ro", "label_en"
        from "field_catalog"
        order by "field_key", "adapter_key"`,
  );
}

export function buildHomeDisplaySettingsStatement(db: Db) {
  return db.execute(
    sql`select "show_absolute", "show_percent", "show_arrow"
        from "home_display_settings" where "id" = 1`,
  );
}

export function buildHomeDisplayColumnsStatement(db: Db) {
  return db.execute(
    sql`select "field_key", "position", "show_absolute", "show_percent", "show_arrow"
        from "home_display_columns" order by "position"`,
  );
}

export function buildHomeDisplayEtfsStatement(db: Db) {
  return db.execute(
    sql`select "etf_id", "visible" from "home_display_etfs"`,
  );
}

/**
 * The newest `ok` report per ETF (decision 1, US-016). Shared by
 * `buildLatestOkValuesStatement` and `buildPreviousAvailableValuesStatement` (US-036 T-2) so the
 * two statements can never disagree on what "newest `ok` report" means.
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
 * Per-(etf, field_key), the newest `ok` report strictly before that ETF's newest `ok` report
 * (decision 1) that carries a non-null value for that field — regardless of the exact number of
 * calendar days between them (US-036 T-2/AC4: "the previous *available* report per figure", not
 * "yesterday's report"). Uses `distinct on` over a candidate set restricted to `ok` reports with
 * a non-null value, ordered newest-first per field, so each field gets its own nearest earlier
 * comparison point. A missing previous value for a field simply yields no row here — the read
 * model turns "no row" into `delta: null`, never a guess.
 */
export function buildPreviousAvailableValuesStatement(db: Db) {
  return db.execute(
    sql`select distinct on ("candidate"."etf_id", "candidate"."field_key")
               "candidate"."etf_id", "candidate"."report_date" as "previous_date",
               "candidate"."field_key", "candidate"."numeric_value"
        from (
          select "r"."etf_id", "r"."id" as "report_id", "r"."report_date", "rv"."field_key", "rv"."numeric_value"
          from "reports" "r"
          join "report_values" "rv" on "rv"."report_id" = "r"."id"
          where "r"."status" = 'ok' and "rv"."numeric_value" is not null
        ) "candidate"
        join ${LATEST_OK_REPORT_FRAGMENT} "latest"
          on "latest"."etf_id" = "candidate"."etf_id"
         and "candidate"."report_date" < "latest"."report_date"
        order by "candidate"."etf_id", "candidate"."field_key", "candidate"."report_date" desc, "candidate"."report_id" desc`,
  );
}

const NEWEST_REPORT_LINK_FRAGMENT = sql`(
  select distinct on ("etf_id") "etf_id", "source_url", "fetched_at"
  from "reports"
  where "source_url" is not null
  order by "etf_id", "report_date" desc, "id" desc
)`;

/**
 * The newest known report link per ETF (AC4 — "whatever its status": the symbol always links
 * to the newest PDF, independent of the values shown; US-030 AC4 — a no-adapter ETF's stored
 * `etf_report_links` row competes with the newest `reports.source_url`). A NULL `fetched_at`
 * counts as older than any link row; a tie goes to the report (strict `>`, tech-lead point 6).
 */
export function buildLatestReportLinksStatement(db: Db) {
  return db.execute(
    sql`select "e"."id" as "etf_id",
               case when "l"."source_url" is not null
                      and ("r"."source_url" is null or "r"."fetched_at" is null or "l"."discovered_at" > "r"."fetched_at")
                    then "l"."source_url" else "r"."source_url" end as "source_url"
        from "etfs" "e"
        left join ${NEWEST_REPORT_LINK_FRAGMENT} "r" on "r"."etf_id" = "e"."id"
        left join "etf_report_links" "l" on "l"."etf_id" = "e"."id"
        where "e"."is_active" = true and ("r"."source_url" is not null or "l"."source_url" is not null)`,
  );
}

/**
 * Report-derived links only (pre-US-030 reading), used when `etf_report_links` is missing from
 * the schema (DEC-019 §3) — equals the full statement whenever no `etf_report_links` row exists.
 */
export function buildReportOnlyLinksStatement(db: Db) {
  return db.execute(
    sql`select "e"."id" as "etf_id", "r"."source_url"
        from "etfs" "e"
        join ${NEWEST_REPORT_LINK_FRAGMENT} "r" on "r"."etf_id" = "e"."id"
        where "e"."is_active" = true`,
  );
}

const REPORT_LINKS_TABLE = getTableName(etfReportLinks);
const HOME_DISPLAY_TABLES = new Set([
  "home_display_settings",
  "home_display_columns",
  "home_display_etfs",
]);

function isMissingReportLinksTable(error: unknown): boolean {
  const described = describeLoadError(error);
  return described.code === "42P01" && described.relation === REPORT_LINKS_TABLE;
}

function isMissingHomeDisplayTable(error: unknown): boolean {
  const described = describeLoadError(error);
  return described.code === "42P01" &&
    described.relation !== undefined &&
    HOME_DISPLAY_TABLES.has(described.relation);
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

type EtfAgg = {
  id: number;
  symbol: string;
  name: string;
  adapterKey: string | null;
  trackedFieldKeys: Set<string>;
};

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
        name: String(row.name ?? row.symbol),
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

/** Per (etfId, fieldKey): the newest earlier `ok` report with a non-null value for that field. */
type PreviousEntry = { previousDate: string; numericValue: string | null };

function parsePreviousValues(previousRows: readonly Record<string, unknown>[]): Map<number, Map<string, PreviousEntry>> {
  const byEtf = new Map<number, Map<string, PreviousEntry>>();
  for (const row of previousRows) {
    if (row.field_key === null || row.field_key === undefined) {
      continue;
    }
    const etfId = Number(row.etf_id);
    let byField = byEtf.get(etfId);
    if (!byField) {
      byField = new Map<string, PreviousEntry>();
      byEtf.set(etfId, byField);
    }
    byField.set(String(row.field_key), {
      previousDate: toIsoDateString(row.previous_date),
      numericValue: row.numeric_value === null ? null : String(row.numeric_value),
    });
  }
  return byEtf;
}

/**
 * `null` unless there is an exact, well-formed comparison to show against the nearest earlier
 * report that has a value for this field (US-036 T-2/AC4/AC5) — never a guessed value, and the
 * exact number of calendar days between the two reports is irrelevant.
 */
function computeCellDelta(
  value: string | null,
  previousByField: Map<string, PreviousEntry> | undefined,
  fieldKey: string,
): HomeCellDelta | null {
  if (value === null || !isCanonicalDecimal(value) || previousByField === undefined) {
    return null;
  }
  const previous = previousByField.get(fieldKey);
  if (
    previous === undefined ||
    previous.numericValue === null ||
    !isCanonicalDecimal(previous.numericValue)
  ) {
    return null;
  }
  return { ...computeDelta(value, previous.numericValue), previousDate: previous.previousDate };
}

function parseLinks(linkRows: readonly Record<string, unknown>[]): Map<number, string> {
  const byEtf = new Map<number, string>();
  for (const row of linkRows) {
    byEtf.set(Number(row.etf_id), String(row.source_url));
  }
  return byEtf;
}

type CatalogueField = { fieldKey: string; labelRo: string; labelEn: string; order: number };

function parseCatalogueFields(rows: readonly Record<string, unknown>[]): CatalogueField[] {
  const byKey = new Map<string, CatalogueField>();
  for (const row of [...rows].sort((a, b) => {
    const left = Number(a.id);
    const right = Number(b.id);
    return Number.isFinite(left) && Number.isFinite(right) ? left - right : 0;
  })) {
    const fieldKey = String(row.field_key);
    if (!byKey.has(fieldKey)) {
      byKey.set(fieldKey, {
        fieldKey,
        labelRo: String(row.label_ro),
        labelEn: String(row.label_en),
        order: Number.isFinite(Number(row.id)) ? Number(row.id) : byKey.size,
      });
    }
  }
  return [...byKey.values()];
}

function nullablePgBoolean(value: unknown): boolean | null {
  return value === null || value === undefined ? null : parsePgBoolean(value);
}

function buildViewModel(
  etfRows: readonly Record<string, unknown>[],
  catalogRows: readonly Record<string, unknown>[],
  valueRows: readonly Record<string, unknown>[],
  previousRows: readonly Record<string, unknown>[],
  linkRows: readonly Record<string, unknown>[],
  registry: AdapterRegistry,
  displaySettingsRows: readonly Record<string, unknown>[] = [],
  displayColumnRows: readonly Record<string, unknown>[] = [],
  displayEtfRows: readonly Record<string, unknown>[] = [],
): HomeTableViewModel {
  const defaultColumns = parseColumns(etfRows, catalogRows);
  const { order, byId } = parseEtfs(etfRows);
  const valuesByEtf = parseValues(valueRows);
  const previousByEtf = parsePreviousValues(previousRows);
  const linksByEtf = parseLinks(linkRows);
  const settingsRow = displaySettingsRows[0];
  const saved = settingsRow !== undefined;
  const showAbsolute = saved ? parsePgBoolean(settingsRow.show_absolute) : true;
  const showPercent = saved ? parsePgBoolean(settingsRow.show_percent) : true;
  const showArrow = saved ? parsePgBoolean(settingsRow.show_arrow) : true;
  const catalogue = parseCatalogueFields(catalogRows);
  const labels = new Map(catalogue.map((field) => [field.fieldKey, field]));
  const savedColumns = displayColumnRows.map((row) => {
    const fieldKey = String(row.field_key);
    const label = labels.get(fieldKey);
    const columnAbsolute = nullablePgBoolean(row.show_absolute);
    const columnPercent = nullablePgBoolean(row.show_percent);
    const columnArrow = nullablePgBoolean(row.show_arrow);
    return {
      fieldKey,
      labelRo: label?.labelRo ?? fieldKey,
      labelEn: label?.labelEn ?? fieldKey,
      showAbsolute: columnAbsolute ?? showAbsolute,
      showPercent: columnPercent ?? showPercent,
      showArrow: columnArrow ?? showArrow,
    };
  });
  const columns: HomeColumn[] = saved ? savedColumns : defaultColumns;
  const hiddenEtfs = new Map(
    displayEtfRows.map((row) => [Number(row.etf_id), !parsePgBoolean(row.visible)]),
  );
  const panelColumns = new Map(catalogue.map((field) => [field.fieldKey, field]));
  for (const column of defaultColumns) {
    if (!panelColumns.has(column.fieldKey)) {
      panelColumns.set(column.fieldKey, { ...column, order: Number.MAX_SAFE_INTEGER });
    }
  }
  const selectedColumnOrder = new Map(
    (saved ? savedColumns : defaultColumns).map((column, index) => [column.fieldKey, index]),
  );
  const savedColumnDetails = new Map(
    displayColumnRows.map((row) => [String(row.field_key), row]),
  );
  const panelColumnList = [...panelColumns.values()]
    .sort((a, b) => {
      const left = selectedColumnOrder.get(a.fieldKey);
      const right = selectedColumnOrder.get(b.fieldKey);
      if (left !== undefined || right !== undefined) {
        if (left === undefined) return 1;
        if (right === undefined) return -1;
        if (left !== right) return left - right;
      }
      return a.order - b.order;
    })
    .map((field) => ({
      fieldKey: field.fieldKey,
      labelRo: field.labelRo,
      labelEn: field.labelEn,
      visible: selectedColumnOrder.has(field.fieldKey),
      position: selectedColumnOrder.get(field.fieldKey) ?? null,
      catalogueOrder: field.order,
      showAbsolute: saved ? nullablePgBoolean(savedColumnDetails.get(field.fieldKey)?.show_absolute) : null,
      showPercent: saved ? nullablePgBoolean(savedColumnDetails.get(field.fieldKey)?.show_percent) : null,
      showArrow: saved ? nullablePgBoolean(savedColumnDetails.get(field.fieldKey)?.show_arrow) : null,
    }));
  const customization: HomeDisplayPanelModel = {
    saved,
    showAbsolute,
    showPercent,
    showArrow,
    etfs: order.map((id) => {
      const etf = byId.get(id)!;
      return { etfId: id, symbol: etf.symbol, name: etf.name, visible: !hiddenEtfs.get(id) };
    }),
    columns: panelColumnList,
  };

  const rows: HomeRow[] = order.filter((id) => !saved || !hiddenEtfs.get(id)).map((id) => {
    const etf = byId.get(id)!;
    const valueAgg = valuesByEtf.get(id);
    const previousAgg = previousByEtf.get(id);
    const valueDate = valueAgg?.reportDate ?? null;
    const cells: Record<string, HomeCell> = {};
    for (const column of columns) {
      if (!saved && !etf.trackedFieldKeys.has(column.fieldKey)) {
        cells[column.fieldKey] = { tracked: false };
        continue;
      }
      const value = valueAgg?.values.get(column.fieldKey) ?? null;
      cells[column.fieldKey] = {
        tracked: true,
        value,
        delta: computeCellDelta(value, previousAgg, column.fieldKey),
      };
    }
    return {
      symbol: etf.symbol,
      name: etf.name,
      adapterAvailable: etf.adapterKey !== null && registry.get(etf.adapterKey) !== undefined,
      latestPdfUrl: linksByEtf.get(id) ?? null,
      valueDate,
      cells,
    };
  });

  return { columns, rows, customization };
}

/**
 * Loads the table and Customize panel in one batch. If an optional home-display table is
 * missing, use the unchanged unsaved view; if the existing report-link enrichment is missing,
 * retain its narrower report-only fallback.
 */
export function createHomeTableLoader(
  db: Db,
  registry: AdapterRegistry = defaultAdapterRegistry,
  run: BatchRunner = neonBatchRunner(db),
): () => Promise<HomeTableViewModel> {
  const homeStatements = (linksStatement: (db: Db) => ReturnType<Db["execute"]>) => [
    buildActiveEtfsStatement(db),
    buildFieldCatalogStatement(db),
    buildLatestOkValuesStatement(db),
    buildPreviousAvailableValuesStatement(db),
    linksStatement(db),
  ];
  const displayStatements = [
    buildHomeDisplaySettingsStatement(db),
    buildHomeDisplayColumnsStatement(db),
    buildHomeDisplayEtfsStatement(db),
  ];
  const makeViewModel = (
    results: readonly unknown[],
    displayOffset: number,
  ): HomeTableViewModel => {
    const [etfResult, catalogResult, valueResult, previousResult, linkResult] =
      results.slice(displayOffset);
    return buildViewModel(
      rowsOf(etfResult),
      rowsOf(catalogResult),
      rowsOf(valueResult),
      rowsOf(previousResult),
      rowsOf(linkResult),
      registry,
      displayOffset === 0 ? [] : rowsOf(results[0]),
      displayOffset === 0 ? [] : rowsOf(results[1]),
      displayOffset === 0 ? [] : rowsOf(results[2]),
    );
  };

  const loadDefaultView = async () => {
    let results: readonly unknown[];
    try {
      results = await run(homeStatements(buildLatestReportLinksStatement));
    } catch (error) {
      if (!isMissingReportLinksTable(error)) throw error;
      logLoadError("home/report-links", error);
      results = await run(homeStatements(buildReportOnlyLinksStatement));
    }
    return makeViewModel(results, 0);
  };

  return async () => {
    try {
      const results = await run([
        ...displayStatements,
        ...homeStatements(buildLatestReportLinksStatement),
      ]);
      return makeViewModel(results, 3);
    } catch (error) {
      if (isMissingHomeDisplayTable(error)) {
        logLoadError("home/display-settings", error);
        return loadDefaultView();
      }
      if (!isMissingReportLinksTable(error)) throw error;
      logLoadError("home/report-links", error);
      const results = await run([
        ...displayStatements,
        ...homeStatements(buildReportOnlyLinksStatement),
      ]);
      return makeViewModel(results, 3);
    }
  };
}
