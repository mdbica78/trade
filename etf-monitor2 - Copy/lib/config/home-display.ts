import { sql } from "drizzle-orm";
import type { Db } from "../db/index";
import { rowsOf, type BatchRunner } from "../ingestion/store";

export type HomeDisplayEtf = { etfId: number; symbol: string; name: string; visible: boolean };
export type HomeDisplayColumn = {
  fieldKey: string;
  position: number;
  labelRo: string;
  labelEn: string;
  showAbsolute: boolean | null;
  showPercent: boolean | null;
  showArrow: boolean | null;
};
export type HomeDisplayCatalogueField = { fieldKey: string; labelRo: string; labelEn: string };
export type HomeDisplay = {
  saved: boolean;
  showAbsolute: boolean;
  showPercent: boolean;
  showArrow: boolean;
  etfs: readonly HomeDisplayEtf[];
  columns: readonly HomeDisplayColumn[];
  catalogue: readonly HomeDisplayCatalogueField[];
};
export type HomeDisplayDeps = { db: Db; run: BatchRunner };

type NormalizedColumn = {
  fieldKey: string;
  position: number;
  showAbsolute: boolean | null;
  showPercent: boolean | null;
  showArrow: boolean | null;
};
type NormalizedEtf = { etfId: number; visible: boolean };
type NormalizedInput = {
  showAbsolute: boolean;
  showPercent: boolean;
  showArrow: boolean;
  columns: NormalizedColumn[];
  etfs: NormalizedEtf[];
};

export type SaveHomeDisplayResult =
  | { ok: true; display: HomeDisplay }
  | {
      ok: false;
      error:
        | "invalid_input"
        | "unknown_etf"
        | "unknown_field"
        | "duplicate_field"
        | "duplicate_position";
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function optionalBoolean(value: unknown): boolean | null | undefined {
  if (value === undefined || value === null) return null;
  return typeof value === "boolean" ? value : undefined;
}

function normalizeInput(input: unknown): NormalizedInput | null {
  if (!isRecord(input) || typeof input.showAbsolute !== "boolean" ||
      typeof input.showPercent !== "boolean" || typeof input.showArrow !== "boolean" ||
      !Array.isArray(input.columns) || !Array.isArray(input.etfs)) {
    return null;
  }

  const columns: NormalizedColumn[] = [];
  for (const item of input.columns) {
    if (!isRecord(item) || typeof item.fieldKey !== "string" || item.fieldKey.trim() === "" ||
        !Number.isSafeInteger(item.position) || Number(item.position) < 0) return null;
    const showAbsolute = optionalBoolean(item.showAbsolute);
    const showPercent = optionalBoolean(item.showPercent);
    const showArrow = optionalBoolean(item.showArrow);
    if (showAbsolute === undefined || showPercent === undefined || showArrow === undefined) return null;
    columns.push({
      fieldKey: item.fieldKey.trim(),
      position: Number(item.position),
      showAbsolute,
      showPercent,
      showArrow,
    });
  }

  const etfs: NormalizedEtf[] = [];
  for (const item of input.etfs) {
    if (!isRecord(item) || !Number.isSafeInteger(item.etfId) || Number(item.etfId) <= 0 ||
        typeof item.visible !== "boolean") return null;
    etfs.push({ etfId: Number(item.etfId), visible: item.visible });
  }

  return {
    showAbsolute: input.showAbsolute,
    showPercent: input.showPercent,
    showArrow: input.showArrow,
    columns,
    etfs,
  };
}

export async function saveHomeDisplay(input: unknown, deps: HomeDisplayDeps): Promise<SaveHomeDisplayResult> {
  const normalized = normalizeInput(input);
  if (normalized === null) return { ok: false, error: "invalid_input" };

  const fieldKeys = normalized.columns.map((column) => column.fieldKey);
  if (new Set(fieldKeys).size !== fieldKeys.length) return { ok: false, error: "duplicate_field" };
  const positions = normalized.columns.map((column) => column.position);
  if (new Set(positions).size !== positions.length) return { ok: false, error: "duplicate_position" };
  const etfIds = normalized.etfs.map((etf) => etf.etfId);
  if (new Set(etfIds).size !== etfIds.length) return { ok: false, error: "invalid_input" };

  const [activeEtfsResult, catalogueResult] = await deps.run([
    deps.db.execute(
      sql`select "id", "symbol", "name" from "etfs"
          where "is_active" = true order by "symbol", "id"`,
    ),
    deps.db.execute(
      sql`select "field_key", "label_ro", "label_en" from "field_catalog"
          order by "field_key", "id"`,
    ),
  ]);
  const activeEtfs = rowsOf(activeEtfsResult);
  const catalogueByKey = new Map<string, HomeDisplayCatalogueField>();
  for (const row of rowsOf(catalogueResult)) {
    const fieldKey = String(row.field_key);
    if (!catalogueByKey.has(fieldKey)) {
      catalogueByKey.set(fieldKey, {
        fieldKey,
        labelRo: String(row.label_ro),
        labelEn: String(row.label_en),
      });
    }
  }
  const knownEtfs = new Set(activeEtfs.map((row) => Number(row.id)));
  if (etfIds.some((id) => !knownEtfs.has(id))) return { ok: false, error: "unknown_etf" };
  if (fieldKeys.some((key) => !catalogueByKey.has(key))) return { ok: false, error: "unknown_field" };

  const statements = [
    deps.db.execute(sql`delete from "home_display_columns"`),
    deps.db.execute(sql`delete from "home_display_etfs"`),
    deps.db.execute(sql`delete from "home_display_settings"`),
    deps.db.execute(
      sql`insert into "home_display_settings" ("id", "show_absolute", "show_percent", "show_arrow")
          values (1, ${normalized.showAbsolute}, ${normalized.showPercent}, ${normalized.showArrow})`,
    ),
  ];
  if (normalized.columns.length > 0) {
    const values = normalized.columns.map((column) => sql`(
      ${column.fieldKey}, ${column.position}, ${column.showAbsolute}, ${column.showPercent}, ${column.showArrow}
    )`);
    statements.push(
      deps.db.execute(sql`insert into "home_display_columns"
        ("field_key", "position", "show_absolute", "show_percent", "show_arrow")
        values ${sql.join(values, sql`, `)}`),
    );
  }
  if (normalized.etfs.length > 0) {
    const values = normalized.etfs.map((etf) => sql`(${etf.etfId}, ${etf.visible})`);
    statements.push(
      deps.db.execute(sql`insert into "home_display_etfs" ("etf_id", "visible")
        values ${sql.join(values, sql`, `)}`),
    );
  }
  await deps.run(statements);
  const visibleEtfs = new Map(normalized.etfs.map((etf) => [etf.etfId, etf.visible]));
  return {
    ok: true,
    display: {
      saved: true,
      showAbsolute: normalized.showAbsolute,
      showPercent: normalized.showPercent,
      showArrow: normalized.showArrow,
      etfs: activeEtfs.map((row) => ({
        etfId: Number(row.id),
        symbol: String(row.symbol),
        name: String(row.name),
        visible: visibleEtfs.get(Number(row.id)) ?? true,
      })),
      columns: normalized.columns.map((column) => ({
        ...column,
        ...catalogueByKey.get(column.fieldKey)!,
      })).sort((a, b) => a.position - b.position),
      catalogue: [...catalogueByKey.values()],
    },
  };
}
