import { sql } from "drizzle-orm";
import type { Db } from "../db/index";
import type { AdapterRegistry } from "../extraction/adapters/types";
import { rowsOf, type BatchRunner } from "../ingestion/store";
import { normaliseSymbol } from "./etfs";

export const MAX_WIDGETS_PER_ETF = 6;
export const WIDGET_OPERATIONS = ["change", "percent_change", "average", "min", "max"] as const;
export const WIDGET_PERIOD_UNITS = ["days", "reports"] as const;

export type WidgetOperation = (typeof WIDGET_OPERATIONS)[number];
export type WidgetPeriodUnit = (typeof WIDGET_PERIOD_UNITS)[number];
export type WidgetDefinition = {
  operation: WidgetOperation;
  fieldKey: string;
  periodUnit: WidgetPeriodUnit;
  periodAmount: number;
  title?: string;
};
export type Widget = WidgetDefinition & { id: number; etfId: number; slot: number; updatedAt: Date };
export type WidgetError = "unknown_operation" | "unknown_field" | "bad_period" | "bad_title" | "bad_slot" | "unknown_etf" | "too_many";
export type WidgetResult<T> = { ok: true; value: T } | { ok: false; error: WidgetError };
export type WidgetCatalogueField = { fieldKey: string; numeric: boolean };
export type WidgetConfigDeps = {
  db: Db;
  run: BatchRunner;
  registry: Pick<AdapterRegistry, "get">;
  now: () => Date;
};

export function isRecord(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}

export function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

export function validateWidgetDefinition(
  input: unknown,
  catalogue: readonly WidgetCatalogueField[],
): WidgetResult<WidgetDefinition> {
  if (!isRecord(input) || !hasOnlyKeys(input, ["operation", "fieldKey", "periodUnit", "periodAmount", "title"])) {
    return { ok: false, error: "unknown_operation" };
  }
  if (!WIDGET_OPERATIONS.some((operation) => operation === input.operation)) {
    return { ok: false, error: "unknown_operation" };
  }
  if (typeof input.fieldKey !== "string" ||
      !catalogue.some((field) => field.numeric && field.fieldKey === input.fieldKey)) {
    return { ok: false, error: "unknown_field" };
  }
  if (!WIDGET_PERIOD_UNITS.some((unit) => unit === input.periodUnit) ||
      !Number.isInteger(input.periodAmount) ||
      Number(input.periodAmount) < 1 || Number(input.periodAmount) > 365) {
    return { ok: false, error: "bad_period" };
  }
  if (input.title !== undefined && (typeof input.title !== "string" || input.title.length > 60)) {
    return { ok: false, error: "bad_title" };
  }
  return {
    ok: true,
    value: {
      operation: input.operation as WidgetOperation,
      fieldKey: input.fieldKey,
      periodUnit: input.periodUnit as WidgetPeriodUnit,
      periodAmount: input.periodAmount as number,
      ...(input.title === undefined ? {} : { title: input.title as string }),
    },
  };
}

export function validSlot(slot: unknown): slot is number {
  return Number.isInteger(slot) && Number(slot) >= 1 && Number(slot) <= MAX_WIDGETS_PER_ETF;
}

export function mergeWidgetChanges(existing: WidgetDefinition, changes: Record<string, unknown>): Record<string, unknown> {
  return {
    operation: existing.operation,
    fieldKey: existing.fieldKey,
    periodUnit: existing.periodUnit,
    periodAmount: existing.periodAmount,
    ...(existing.title === undefined ? {} : { title: existing.title }),
    ...changes,
  };
}

async function resolveEtf(symbol: unknown, deps: WidgetConfigDeps): Promise<
  { etfId: number; catalogue: WidgetCatalogueField[] } | null
> {
  const normalised = normaliseSymbol(symbol);
  if (normalised === null) return null;
  const [etfsResult, catalogueResult] = await deps.run([
    deps.db.execute(sql`select "id", "adapter_key" from "etfs" where "symbol" = ${normalised}`),
    deps.db.execute(
      sql`select "fc"."field_key" from "field_catalog" "fc"
          join "etfs" "e" on "e"."adapter_key" = "fc"."adapter_key"
          where "e"."symbol" = ${normalised}`,
    ),
  ]);
  const row = rowsOf(etfsResult)[0];
  if (!row) return null;
  const adapterKey = row.adapter_key === null ? null : String(row.adapter_key);
  // Adapter fieldKeys produce canonical numericValue; the catalogue intersection is the numeric whitelist.
  const available = new Set(deps.registry.get(adapterKey)?.fieldKeys ?? []);
  return {
    etfId: Number(row.id),
    catalogue: rowsOf(catalogueResult).map((field) => ({
      fieldKey: String(field.field_key),
      numeric: available.has(String(field.field_key)),
    })),
  };
}

function widgetFromRow(row: Record<string, unknown>): Widget {
  return {
    id: Number(row.id),
    etfId: Number(row.etf_id),
    slot: Number(row.slot),
    operation: String(row.operation) as WidgetOperation,
    fieldKey: String(row.field_key),
    periodUnit: String(row.period_unit) as WidgetPeriodUnit,
    periodAmount: Number(row.period_amount),
    ...(row.title === null ? {} : { title: String(row.title) }),
    updatedAt: new Date(String(row.updated_at)),
  };
}

const widgetColumns = sql`"id", "etf_id", "slot", "operation", "field_key", "period_unit",
  "period_amount", "title", "updated_at"`;

async function readWidgets(etfId: number, deps: WidgetConfigDeps): Promise<Widget[]> {
  const [result] = await deps.run([
    deps.db.execute(
      sql`select ${widgetColumns} from "etf_widgets" where "etf_id" = ${etfId} order by "slot"`,
    ),
  ]);
  return rowsOf(result).map(widgetFromRow);
}

export async function listWidgetsForEtf(symbol: unknown, deps: WidgetConfigDeps): Promise<WidgetResult<Widget[]>> {
  const normalised = normaliseSymbol(symbol);
  if (normalised === null) return { ok: false, error: "unknown_etf" };
  const [etfsResult] = await deps.run([
    deps.db.execute(sql`select "id" from "etfs" where "symbol" = ${normalised}`),
  ]);
  const row = rowsOf(etfsResult)[0];
  if (!row) return { ok: false, error: "unknown_etf" };
  return { ok: true, value: await readWidgets(Number(row.id), deps) };
}

function insertWidget(etfId: number, slot: number, definition: WidgetDefinition, deps: WidgetConfigDeps) {
  return deps.db.execute(sql`insert into "etf_widgets"
    ("etf_id", "slot", "operation", "field_key", "period_unit", "period_amount", "title", "updated_at")
    values (${etfId}, ${slot}, ${definition.operation}, ${definition.fieldKey},
      ${definition.periodUnit}, ${definition.periodAmount}, ${definition.title ?? null}, ${deps.now()})
    returning ${widgetColumns}`);
}

export async function addWidget(
  input: { symbol: unknown; definition: unknown },
  deps: WidgetConfigDeps,
): Promise<WidgetResult<Widget>> {
  const etf = await resolveEtf(input.symbol, deps);
  if (etf === null) return { ok: false, error: "unknown_etf" };
  const validated = validateWidgetDefinition(input.definition, etf.catalogue);
  if (!validated.ok) return validated;
  const occupied = new Set((await readWidgets(etf.etfId, deps)).map((widget) => widget.slot));
  const slot = Array.from({ length: MAX_WIDGETS_PER_ETF }, (_, index) => index + 1)
    .find((candidate) => !occupied.has(candidate));
  if (slot === undefined) return { ok: false, error: "too_many" };
  const [result] = await deps.run([insertWidget(etf.etfId, slot, validated.value, deps)]);
  return { ok: true, value: widgetFromRow(rowsOf(result)[0]) };
}

export async function updateWidget(
  input: { symbol: unknown; slot: unknown; changes: unknown },
  deps: WidgetConfigDeps,
): Promise<WidgetResult<Widget>> {
  if (!validSlot(input.slot)) return { ok: false, error: "bad_slot" };
  const etf = await resolveEtf(input.symbol, deps);
  if (etf === null) return { ok: false, error: "unknown_etf" };
  const existing = (await readWidgets(etf.etfId, deps)).find((widget) => widget.slot === input.slot);
  if (!existing) return { ok: false, error: "bad_slot" };
  if (!isRecord(input.changes)) return { ok: false, error: "unknown_operation" };
  const validated = validateWidgetDefinition(mergeWidgetChanges(existing, input.changes), etf.catalogue);
  if (!validated.ok) return validated;
  const value = validated.value;
  const [result] = await deps.run([
    deps.db.execute(sql`update "etf_widgets" set
      "operation" = ${value.operation}, "field_key" = ${value.fieldKey},
      "period_unit" = ${value.periodUnit}, "period_amount" = ${value.periodAmount},
      "title" = ${value.title ?? null}, "updated_at" = ${deps.now()}
      where "etf_id" = ${etf.etfId} and "slot" = ${input.slot}
      returning ${widgetColumns}`),
  ]);
  return { ok: true, value: widgetFromRow(rowsOf(result)[0]) };
}

export async function clearWidget(
  input: { symbol: unknown; slot: unknown | "all" },
  deps: WidgetConfigDeps,
): Promise<WidgetResult<number>> {
  if (input.slot !== "all" && !validSlot(input.slot)) return { ok: false, error: "bad_slot" };
  const etf = await resolveEtf(input.symbol, deps);
  if (etf === null) return { ok: false, error: "unknown_etf" };
  if (input.slot !== "all" && !(await readWidgets(etf.etfId, deps)).some((widget) => widget.slot === input.slot)) {
    return { ok: false, error: "bad_slot" };
  }
  const [result] = await deps.run([
    deps.db.execute(input.slot === "all"
      ? sql`delete from "etf_widgets" where "etf_id" = ${etf.etfId} returning "id"`
      : sql`delete from "etf_widgets" where "etf_id" = ${etf.etfId} and "slot" = ${input.slot} returning "id"`),
  ]);
  return { ok: true, value: rowsOf(result).length };
}

export async function replaceWidgets(
  input: { symbol: unknown; definitions: unknown },
  deps: WidgetConfigDeps,
): Promise<WidgetResult<Widget[]>> {
  const etf = await resolveEtf(input.symbol, deps);
  if (etf === null) return { ok: false, error: "unknown_etf" };
  if (!Array.isArray(input.definitions)) return { ok: false, error: "unknown_operation" };
  if (input.definitions.length > MAX_WIDGETS_PER_ETF) return { ok: false, error: "too_many" };
  const definitions: WidgetDefinition[] = [];
  for (const entry of input.definitions) {
    const validated = validateWidgetDefinition(entry, etf.catalogue);
    if (!validated.ok) return validated;
    definitions.push(validated.value);
  }
  const results = await deps.run([
    deps.db.execute(sql`delete from "etf_widgets" where "etf_id" = ${etf.etfId}`),
    ...definitions.map((definition, index) => insertWidget(etf.etfId, index + 1, definition, deps)),
  ]);
  return { ok: true, value: results.slice(1).map((result) => widgetFromRow(rowsOf(result)[0])) };
}
