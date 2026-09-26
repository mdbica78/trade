import { sql } from "drizzle-orm";
import type { Db } from "../db/index";
import { parsePgBoolean } from "../ingestion/load-etfs";
import { rowsOf, type BatchRunner } from "../ingestion/store";
import type { AdapterRegistry } from "../extraction/adapters/types";
import { normaliseSymbol } from "./etfs";

export type TrackedFieldDeps = { db: Db; run: BatchRunner; registry: Pick<AdapterRegistry, "get"> };

export type MoveDirection = "up" | "down";

export type AvailableField = {
  fieldKey: string;
  labelRo: string;
  labelEn: string;
  unit: string | null;
  tracked: boolean;
  position: number | null;
};

export type TrackedField = {
  fieldKey: string;
  labelRo: string;
  labelEn: string;
  unit: string | null;
  position: number;
  available: boolean;
};

export type TrackedFieldsView = {
  etf: { symbol: string; name: string; adapterKey: string | null; adapterAvailable: boolean; isActive: boolean };
  /** decision 7: registry `fieldKeys` intersected with the catalogue, in `field_catalog.id` order. */
  available: readonly AvailableField[];
  /** every tracked row, loader order (`display_order, field_key`); flagged rows have `available: false`. */
  tracked: readonly TrackedField[];
};

/** Decision 7: what the registered adapter can extract, intersected with what the catalogue documents. */
export function availableFieldKeys(
  adapterKey: string | null,
  catalogueKeysForAdapter: readonly string[],
  registry: Pick<AdapterRegistry, "get">,
): string[] {
  if (adapterKey === null) return [];
  const adapter = registry.get(adapterKey);
  if (!adapter) return [];
  const catalogueSet = new Set(catalogueKeysForAdapter);
  return adapter.fieldKeys.filter((key) => catalogueSet.has(key));
}

function labelFallback(fieldKey: string): { labelRo: string; labelEn: string; unit: string | null } {
  return { labelRo: fieldKey, labelEn: fieldKey, unit: null };
}

export async function listFieldsForEtf(symbol: unknown, deps: TrackedFieldDeps): Promise<TrackedFieldsView | null> {
  const normalisedSymbol = normaliseSymbol(symbol);
  if (normalisedSymbol === null) {
    return null;
  }

  const [etfResult, catalogResult, trackedResult] = await deps.run([
    deps.db.execute(
      sql`select "id", "symbol", "name", "adapter_key", "is_active" from "etfs" where "symbol" = ${normalisedSymbol}`,
    ),
    deps.db.execute(
      sql`select "fc"."field_key", "fc"."label_ro", "fc"."label_en", "fc"."unit"
          from "field_catalog" "fc"
          join "etfs" "e" on "e"."adapter_key" = "fc"."adapter_key"
          where "e"."symbol" = ${normalisedSymbol}
          order by "fc"."id"`,
    ),
    deps.db.execute(
      sql`select "t"."field_key"
          from "tracked_fields" "t"
          join "etfs" "e" on "e"."id" = "t"."etf_id"
          where "e"."symbol" = ${normalisedSymbol}
          order by "t"."display_order", "t"."field_key"`,
    ),
  ]);

  const etfRows = rowsOf(etfResult);
  if (etfRows.length === 0) {
    return null;
  }
  const etfRow = etfRows[0];
  const adapterKey = etfRow.adapter_key === null ? null : String(etfRow.adapter_key);

  const catalogueRows = rowsOf(catalogResult);
  const catalogueByKey = new Map<string, { labelRo: string; labelEn: string; unit: string | null }>();
  for (const row of catalogueRows) {
    const fieldKey = String(row.field_key);
    if (!catalogueByKey.has(fieldKey)) {
      catalogueByKey.set(fieldKey, {
        labelRo: String(row.label_ro),
        labelEn: String(row.label_en),
        unit: row.unit === null ? null : String(row.unit),
      });
    }
  }

  const availableKeys = availableFieldKeys(adapterKey, [...catalogueByKey.keys()], deps.registry);
  const availableSet = new Set(availableKeys);

  const trackedFieldKeys = rowsOf(trackedResult).map((row) => String(row.field_key));
  const trackedSet = new Set(trackedFieldKeys);

  const available: AvailableField[] = catalogueRows
    .filter((row) => availableSet.has(String(row.field_key)))
    .map((row) => {
      const fieldKey = String(row.field_key);
      const position = trackedFieldKeys.indexOf(fieldKey);
      return {
        fieldKey,
        labelRo: String(row.label_ro),
        labelEn: String(row.label_en),
        unit: row.unit === null ? null : String(row.unit),
        tracked: trackedSet.has(fieldKey),
        position: position === -1 ? null : position + 1,
      };
    });

  const tracked: TrackedField[] = trackedFieldKeys.map((fieldKey, index) => {
    const label = catalogueByKey.get(fieldKey) ?? labelFallback(fieldKey);
    return {
      fieldKey,
      labelRo: label.labelRo,
      labelEn: label.labelEn,
      unit: label.unit,
      position: index + 1,
      available: availableSet.has(fieldKey),
    };
  });

  return {
    etf: {
      symbol: String(etfRow.symbol),
      name: String(etfRow.name),
      adapterKey,
      adapterAvailable: adapterKey !== null && deps.registry.get(adapterKey) !== undefined,
      isActive: parsePgBoolean(etfRow.is_active),
    },
    available,
    tracked,
  };
}

export type TrackFieldResult =
  | { ok: true; action: "tracked" | "already_tracked"; symbol: string }
  | { ok: false; error: "not_found" | "field_not_available" };

export async function trackField(
  input: { symbol: unknown; fieldKey: unknown },
  deps: TrackedFieldDeps,
): Promise<TrackFieldResult> {
  const symbol = normaliseSymbol(input.symbol);
  if (symbol === null) {
    return { ok: false, error: "not_found" };
  }
  const fieldKey = typeof input.fieldKey === "string" && input.fieldKey !== "" ? input.fieldKey : null;
  if (fieldKey === null) {
    return { ok: false, error: "field_not_available" };
  }

  const [etfResult, catalogResult] = await deps.run([
    deps.db.execute(sql`select "id", "adapter_key" from "etfs" where "symbol" = ${symbol}`),
    deps.db.execute(
      sql`select 1 from "field_catalog" "fc"
          join "etfs" "e" on "e"."adapter_key" = "fc"."adapter_key"
          where "e"."symbol" = ${symbol} and "fc"."field_key" = ${fieldKey}`,
    ),
  ]);

  const etfRows = rowsOf(etfResult);
  if (etfRows.length === 0) {
    return { ok: false, error: "not_found" };
  }
  const adapterKey = etfRows[0].adapter_key === null ? null : String(etfRows[0].adapter_key);
  const hasCatalogueRow = rowsOf(catalogResult).length > 0;
  const registered = adapterKey !== null && deps.registry.get(adapterKey) !== undefined;
  const availableInAdapter = registered ? (deps.registry.get(adapterKey)!.fieldKeys as readonly string[]).includes(fieldKey) : false;

  if (adapterKey === null || !registered || !hasCatalogueRow || !availableInAdapter) {
    return { ok: false, error: "field_not_available" };
  }

  const [insertResult] = await deps.run([
    deps.db.execute(
      sql`insert into "tracked_fields" ("etf_id", "field_key", "display_order")
          select "e"."id", ${fieldKey},
                 coalesce((select max("t"."display_order") from "tracked_fields" "t" where "t"."etf_id" = "e"."id"), -1) + 1
          from "etfs" "e"
          where "e"."symbol" = ${symbol}
            and "e"."adapter_key" = ${adapterKey}
            and exists (
              select 1 from "field_catalog" "fc"
              where "fc"."adapter_key" = "e"."adapter_key" and "fc"."field_key" = ${fieldKey}
            )
          on conflict ("etf_id", "field_key") do nothing
          returning "id"`,
    ),
  ]);

  if (rowsOf(insertResult).length > 0) {
    return { ok: true, action: "tracked", symbol };
  }

  const [existsResult] = await deps.run([
    deps.db.execute(
      sql`select 1 from "tracked_fields" "t"
          join "etfs" "e" on "e"."id" = "t"."etf_id"
          where "e"."symbol" = ${symbol} and "t"."field_key" = ${fieldKey}`,
    ),
  ]);
  if (rowsOf(existsResult).length > 0) {
    return { ok: true, action: "already_tracked", symbol };
  }
  return { ok: false, error: "field_not_available" };
}

export type UntrackFieldResult = { ok: true; symbol: string } | { ok: false; error: "not_found" | "not_tracked" };

export async function untrackField(
  input: { symbol: unknown; fieldKey: unknown },
  deps: Pick<TrackedFieldDeps, "db" | "run">,
): Promise<UntrackFieldResult> {
  const symbol = normaliseSymbol(input.symbol);
  if (symbol === null) {
    return { ok: false, error: "not_found" };
  }
  const fieldKey = typeof input.fieldKey === "string" && input.fieldKey !== "" ? input.fieldKey : null;
  if (fieldKey === null) {
    return { ok: false, error: "not_tracked" };
  }

  const [etfResult] = await deps.run([
    deps.db.execute(sql`select "id" from "etfs" where "symbol" = ${symbol}`),
  ]);
  if (rowsOf(etfResult).length === 0) {
    return { ok: false, error: "not_found" };
  }

  const [deleteResult] = await deps.run([
    deps.db.execute(
      sql`delete from "tracked_fields" "t"
          using "etfs" "e"
          where "t"."etf_id" = "e"."id" and "e"."symbol" = ${symbol} and "t"."field_key" = ${fieldKey}
          returning "t"."id"`,
    ),
  ]);
  if (rowsOf(deleteResult).length === 0) {
    return { ok: false, error: "not_tracked" };
  }
  return { ok: true, symbol };
}

export type MoveFieldResult =
  | { ok: true; moved: boolean; symbol: string }
  | { ok: false; error: "not_found" | "not_tracked" | "invalid_direction" };

export async function moveField(
  input: { symbol: unknown; fieldKey: unknown; direction: unknown },
  deps: Pick<TrackedFieldDeps, "db" | "run">,
): Promise<MoveFieldResult> {
  if (input.direction !== "up" && input.direction !== "down") {
    return { ok: false, error: "invalid_direction" };
  }
  const direction: MoveDirection = input.direction;
  const symbol = normaliseSymbol(input.symbol);
  if (symbol === null) {
    return { ok: false, error: "not_found" };
  }
  const fieldKey = typeof input.fieldKey === "string" && input.fieldKey !== "" ? input.fieldKey : null;
  if (fieldKey === null) {
    return { ok: false, error: "not_tracked" };
  }

  const delta = direction === "up" ? -1 : 1;

  const [checkResult, moveResult] = await deps.run([
    deps.db.execute(
      sql`select "e"."id",
                 exists(
                   select 1 from "tracked_fields" "t"
                   where "t"."etf_id" = "e"."id" and "t"."field_key" = ${fieldKey}
                 ) as "tracked"
          from "etfs" "e" where "e"."symbol" = ${symbol}`,
    ),
    deps.db.execute(
      sql`with "ordered" as (
            select "t"."id", "t"."field_key",
                   (row_number() over (order by "t"."display_order", "t"."field_key") - 1)::int as "pos"
            from "tracked_fields" "t"
            join "etfs" "e" on "e"."id" = "t"."etf_id"
            where "e"."symbol" = ${symbol}
          ),
          "target" as (
            select "pos" as "from_pos", "pos" + ${delta}::int as "to_pos" from "ordered" where "field_key" = ${fieldKey}
          ),
          "renumbered" as (
            select "o"."id",
                   case when "o"."pos" = "tg"."from_pos" then "tg"."to_pos"
                        when "o"."pos" = "tg"."to_pos" then "tg"."from_pos"
                        else "o"."pos" end as "new_pos"
            from "ordered" "o" cross join "target" "tg"
            where "tg"."to_pos" between 0 and (select count(*) - 1 from "ordered")
          )
          update "tracked_fields" "t" set "display_order" = "r"."new_pos"
          from "renumbered" "r" where "t"."id" = "r"."id"
          returning "t"."id"`,
    ),
  ]);

  const checkRows = rowsOf(checkResult);
  if (checkRows.length === 0) {
    return { ok: false, error: "not_found" };
  }
  if (!parsePgBoolean(checkRows[0].tracked)) {
    return { ok: false, error: "not_tracked" };
  }

  return { ok: true, moved: rowsOf(moveResult).length > 0, symbol };
}
