import { getTableName, sql } from "drizzle-orm";
import type { Db } from "../db/index";
import { etfReportLinks } from "../db/schema";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import { isAdapterRegistered, type AdapterRegistry } from "../extraction/adapters/types";
import { parsePgBoolean } from "../ingestion/load-etfs";
import { neonBatchRunner, rowsOf, type BatchRunner } from "../ingestion/store";
import { describeLoadError, logLoadError } from "../log/load-error";
import { computeDelta, isCanonicalDecimal, type Delta } from "./delta";
import { comparePanelColumns } from "./panel-order";

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
  /** The ETF's display name (`etfs.name`, US-036 AC3; `notNull` in the schema). */
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
 * Every catalogue label, ordered so that the first row per `field_key` is its lowest `id`
 * (US-050 B3 — the tie-break when two adapters share a key; supersedes the old alphabetical
 * `adapter_key` rule, which `lib/config/home-display.ts` never used anyway).
 */
export function buildFieldCatalogStatement(db: Db) {
  return db.execute(
    sql`select "id", "field_key", "label_ro", "label_en" from "field_catalog" order by "id"`,
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
    sql`select "latest"."etf_id", "latest"."report_date"::text as "report_date", "rv"."field_key", "rv"."numeric_value"
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
               "candidate"."etf_id", "candidate"."report_date"::text as "previous_date",
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
const HOME_DISPLAY_TABLES = ["home_display_settings", "home_display_columns", "home_display_etfs"];

/** US-050 B2: one predicate for both optional-table checks, so the loader needs only one retry shape. */
function isMissingTable(error: unknown, tables: readonly string[]): boolean {
  const { code, relation } = describeLoadError(error);
  return code === "42P01" && relation !== undefined && tables.includes(relation);
}

type CatalogueField = { fieldKey: string; labelRo: string; labelEn: string; order: number };

/** First row per `field_key` wins (lowest `id`, since `buildFieldCatalogStatement` orders by `id`, US-050 B3). */
function parseCatalogue(catalogRows: readonly Record<string, unknown>[]): Map<string, CatalogueField> {
  const byKey = new Map<string, CatalogueField>();
  for (const row of catalogRows) {
    const fieldKey = String(row.field_key);
    if (!byKey.has(fieldKey)) {
      byKey.set(fieldKey, { fieldKey, labelRo: String(row.label_ro), labelEn: String(row.label_en), order: Number(row.id) });
    }
  }
  return byKey;
}

function labelOf(fieldKey: string, catalogue: ReadonlyMap<string, CatalogueField>): HomeColumn {
  const field = catalogue.get(fieldKey);
  return { fieldKey, labelRo: field?.labelRo ?? fieldKey, labelEn: field?.labelEn ?? fieldKey };
}

function parseColumns(
  etfRows: readonly Record<string, unknown>[],
  catalogue: ReadonlyMap<string, CatalogueField>,
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

  return [...minDisplayOrder.keys()]
    .sort((a, b) => {
      const orderA = minDisplayOrder.get(a)!;
      const orderB = minDisplayOrder.get(b)!;
      return orderA !== orderB ? orderA - orderB : a.localeCompare(b);
    })
    .map((fieldKey) => labelOf(fieldKey, catalogue));
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
        name: String(row.name),
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

type ValueAgg = { reportDate: string; values: Map<string, string | null> };

function parseValues(valueRows: readonly Record<string, unknown>[]): Map<number, ValueAgg> {
  const byEtf = new Map<number, ValueAgg>();
  for (const row of valueRows) {
    const etfId = Number(row.etf_id);
    let agg = byEtf.get(etfId);
    if (!agg) {
      agg = { reportDate: String(row.report_date), values: new Map() };
      byEtf.set(etfId, agg);
    }
    if (row.field_key !== null && row.field_key !== undefined) {
      agg.values.set(String(row.field_key), row.numeric_value === null ? null : String(row.numeric_value));
    }
  }
  return byEtf;
}

/**
 * Per (etfId, fieldKey): the newest earlier `ok` report with a non-null value for that field
 * (US-050 B9: `field_key` comes from the statement's inner join and `numeric_value` is filtered
 * `is not null`, so both are `notNull` here — no defensive null check needed for either).
 */
type PreviousEntry = { previousDate: string; numericValue: string };

function parsePreviousValues(previousRows: readonly Record<string, unknown>[]): Map<number, Map<string, PreviousEntry>> {
  const byEtf = new Map<number, Map<string, PreviousEntry>>();
  for (const row of previousRows) {
    const etfId = Number(row.etf_id);
    let byField = byEtf.get(etfId);
    if (!byField) {
      byField = new Map<string, PreviousEntry>();
      byEtf.set(etfId, byField);
    }
    byField.set(String(row.field_key), {
      previousDate: String(row.previous_date),
      numericValue: String(row.numeric_value),
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
  if (previous === undefined || !isCanonicalDecimal(previous.numericValue)) {
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

function nullablePgBoolean(value: unknown): boolean | null {
  return value === null || value === undefined ? null : parsePgBoolean(value);
}

type ViewModelInput = {
  etfs: readonly Record<string, unknown>[];
  catalog: readonly Record<string, unknown>[];
  values: readonly Record<string, unknown>[];
  previous: readonly Record<string, unknown>[];
  links: readonly Record<string, unknown>[];
  settings: readonly Record<string, unknown>[];
  displayColumns: readonly Record<string, unknown>[];
  displayEtfs: readonly Record<string, unknown>[];
};

function buildViewModel(input: ViewModelInput, registry: AdapterRegistry): HomeTableViewModel {
  const catalogue = parseCatalogue(input.catalog);
  const defaultColumns = parseColumns(input.etfs, catalogue);
  const { order, byId } = parseEtfs(input.etfs);
  const valuesByEtf = parseValues(input.values);
  const previousByEtf = parsePreviousValues(input.previous);
  const linksByEtf = parseLinks(input.links);

  const settingsRow = input.settings[0];
  const saved = settingsRow !== undefined;
  const showAbsolute = saved ? parsePgBoolean(settingsRow.show_absolute) : true;
  const showPercent = saved ? parsePgBoolean(settingsRow.show_percent) : true;
  const showArrow = saved ? parsePgBoolean(settingsRow.show_arrow) : true;

  const savedColumns = input.displayColumns.map((row) => {
    const fieldKey = String(row.field_key);
    return {
      ...labelOf(fieldKey, catalogue),
      showAbsolute: nullablePgBoolean(row.show_absolute) ?? showAbsolute,
      showPercent: nullablePgBoolean(row.show_percent) ?? showPercent,
      showArrow: nullablePgBoolean(row.show_arrow) ?? showArrow,
    };
  });
  // An orphan home_display_columns row with no settings row is ignored: `columns` only reads
  // `savedColumns` when `saved` is true.
  const columns: HomeColumn[] = saved ? savedColumns : defaultColumns;
  const positionOf = new Map(columns.map((column, index) => [column.fieldKey, index]));
  const overrides = new Map<string, Record<string, unknown>>(
    saved ? input.displayColumns.map((row) => [String(row.field_key), row]) : [],
  );

  const hiddenEtfs = new Map(input.displayEtfs.map((row) => [Number(row.etf_id), !parsePgBoolean(row.visible)]));

  // US-050 B5: the panel is the catalogue only — a tracked field with no catalogue row no longer
  // appears here (it still appears in the unsaved `columns`, via `defaultColumns`).
  const panelColumns = [...catalogue.values()]
    .map((field) => ({
      fieldKey: field.fieldKey,
      labelRo: field.labelRo,
      labelEn: field.labelEn,
      visible: positionOf.has(field.fieldKey),
      position: positionOf.get(field.fieldKey) ?? null,
      catalogueOrder: field.order,
      showAbsolute: saved ? nullablePgBoolean(overrides.get(field.fieldKey)?.show_absolute) : null,
      showPercent: saved ? nullablePgBoolean(overrides.get(field.fieldKey)?.show_percent) : null,
      showArrow: saved ? nullablePgBoolean(overrides.get(field.fieldKey)?.show_arrow) : null,
    }))
    .sort(comparePanelColumns);

  const customization: HomeDisplayPanelModel = {
    saved,
    showAbsolute,
    showPercent,
    showArrow,
    etfs: order.map((id) => {
      const etf = byId.get(id)!;
      return { etfId: id, symbol: etf.symbol, name: etf.name, visible: !hiddenEtfs.get(id) };
    }),
    columns: panelColumns,
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
      adapterAvailable: isAdapterRegistered(registry, etf.adapterKey),
      latestPdfUrl: linksByEtf.get(id) ?? null,
      valueDate,
      cells,
    };
  });

  return { columns, rows, customization };
}

/**
 * Loads the table and Customize panel in one batch (US-050 B2). Each optional table — the home-
 * display settings/columns/etfs trio, and the `etf_report_links` enrichment — has its own flag
 * that flips at most once on a `42P01` for that table, dropping it from the next retry; both
 * flags can flip independently, so there are at most 3 attempts. When both are missing, the
 * report-links statement runs (and logs) before the display statements, so the two `[load-error]`
 * lines can come out in either order relative to the old code — nothing pins that order.
 */
export function createHomeTableLoader(
  db: Db,
  registry: AdapterRegistry = defaultAdapterRegistry,
  run: BatchRunner = neonBatchRunner(db),
): () => Promise<HomeTableViewModel> {
  return async () => {
    let reportLinks = true;
    let display = true;
    for (;;) {
      try {
        const results = await run([
          buildActiveEtfsStatement(db),
          buildFieldCatalogStatement(db),
          buildLatestOkValuesStatement(db),
          buildPreviousAvailableValuesStatement(db),
          reportLinks ? buildLatestReportLinksStatement(db) : buildReportOnlyLinksStatement(db),
          ...(display
            ? [buildHomeDisplaySettingsStatement(db), buildHomeDisplayColumnsStatement(db), buildHomeDisplayEtfsStatement(db)]
            : []),
        ]);
        const [etfs, catalog, values, previous, links, settings, displayColumns, displayEtfs] = Array.from(
          { length: 8 },
          (_, i) => rowsOf(results[i]),
        );
        return buildViewModel({ etfs, catalog, values, previous, links, settings, displayColumns, displayEtfs }, registry);
      } catch (error) {
        if (display && isMissingTable(error, HOME_DISPLAY_TABLES)) {
          logLoadError("home/display-settings", error);
          display = false;
          continue;
        }
        if (reportLinks && isMissingTable(error, [REPORT_LINKS_TABLE])) {
          logLoadError("home/report-links", error);
          reportLinks = false;
          continue;
        }
        throw error;
      }
    }
  };
}
