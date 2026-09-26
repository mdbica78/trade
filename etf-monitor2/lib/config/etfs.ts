import { sql } from "drizzle-orm";
import type { Db } from "../db/index";
import { parsePgBoolean } from "../ingestion/load-etfs";
import { rowsOf, type BatchRunner } from "../ingestion/store";
import type { AdapterRegistry } from "../extraction/adapters/types";
import type { DetectionReason, DetectionResult } from "./detect-adapter";

export const BVB_INSTRUMENT_URL_PREFIX =
  "https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=";

/** Decision 5 default: the ETF's instrument page URL is built from its symbol, no live BVB-list check. */
export function bvbInstrumentUrl(symbol: string): string {
  return `${BVB_INSTRUMENT_URL_PREFIX}${symbol}`;
}

/**
 * Trimmed, letters and digits only, checked **before** upper-casing (so a case-folding quirk
 * can never turn invalid input valid), then upper-cased.
 */
export function normaliseSymbol(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^[A-Za-z0-9]+$/.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

export function normaliseName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

export type EtfConfigDeps = {
  db: Db;
  run: BatchRunner;
  registry: Pick<AdapterRegistry, "get" | "list">;
  detect: (etf: { symbol: string; bvbUrl: string }) => Promise<DetectionResult>;
};

export type EtfListItem = {
  symbol: string;
  name: string;
  adapterKey: string | null;
  /** `adapter_key` set AND registered in the adapter registry (same rule as US-016 AC5). */
  adapterAvailable: boolean;
  isActive: boolean;
};

export function registeredAdapterKeys(deps: Pick<EtfConfigDeps, "registry">): string[] {
  return deps.registry.list().map((adapter) => adapter.key);
}

export async function listEtfs(deps: Pick<EtfConfigDeps, "db" | "run" | "registry">): Promise<EtfListItem[]> {
  const [result] = await deps.run([
    deps.db.execute(
      sql`select "symbol", "name", "adapter_key", "is_active" from "etfs" order by "symbol"`,
    ),
  ]);
  return rowsOf(result).map((row) => {
    const adapterKey = row.adapter_key === null ? null : String(row.adapter_key);
    return {
      symbol: String(row.symbol),
      name: String(row.name),
      adapterKey,
      adapterAvailable: adapterKey !== null && deps.registry.get(adapterKey) !== undefined,
      isActive: parsePgBoolean(row.is_active),
    };
  });
}

export type AddEtfResult =
  | { ok: true; action: "added"; symbol: string; adapterKey: string | null; reason: DetectionReason }
  | { ok: true; action: "reactivated"; symbol: string }
  | { ok: false; error: "invalid_symbol" | "invalid_name" | "already_monitored" };

export async function addEtf(
  input: { symbol: unknown; name: unknown },
  deps: EtfConfigDeps,
): Promise<AddEtfResult> {
  const symbol = normaliseSymbol(input.symbol);
  if (symbol === null) {
    return { ok: false, error: "invalid_symbol" };
  }
  const name = normaliseName(input.name);
  if (name === null) {
    return { ok: false, error: "invalid_name" };
  }

  const [existingResult] = await deps.run([
    deps.db.execute(sql`select "id", "is_active" from "etfs" where "symbol" = ${symbol}`),
  ]);
  const existingRows = rowsOf(existingResult);

  if (existingRows.length > 0) {
    const existing = existingRows[0];
    if (parsePgBoolean(existing.is_active)) {
      return { ok: false, error: "already_monitored" };
    }
    const [reactivateResult] = await deps.run([
      deps.db.execute(
        sql`update "etfs" set "is_active" = true where "symbol" = ${symbol} and "is_active" = false returning "id"`,
      ),
    ]);
    if (rowsOf(reactivateResult).length === 0) {
      return { ok: false, error: "already_monitored" };
    }
    return { ok: true, action: "reactivated", symbol };
  }

  const bvbUrl = bvbInstrumentUrl(symbol);
  const detection = await deps.detect({ symbol, bvbUrl });

  const [insertResult] = await deps.run([
    deps.db.execute(
      sql`insert into "etfs" ("symbol", "name", "bvb_url", "adapter_key", "is_active")
          values (${symbol}, ${name}, ${bvbUrl}, ${detection.adapterKey}, true)
          on conflict ("symbol") do nothing
          returning "id"`,
    ),
  ]);
  if (rowsOf(insertResult).length === 0) {
    return { ok: false, error: "already_monitored" };
  }

  return { ok: true, action: "added", symbol, adapterKey: detection.adapterKey, reason: detection.reason };
}

export type SetEtfActiveResult = { ok: true } | { ok: false; error: "not_found" };

export async function setEtfActive(
  input: { symbol: string; active: boolean },
  deps: Pick<EtfConfigDeps, "db" | "run">,
): Promise<SetEtfActiveResult> {
  const [result] = await deps.run([
    deps.db.execute(
      sql`update "etfs" set "is_active" = ${input.active} where "symbol" = ${input.symbol} returning "id"`,
    ),
  ]);
  return rowsOf(result).length === 0 ? { ok: false, error: "not_found" } : { ok: true };
}

export type SetEtfAdapterResult = { ok: true } | { ok: false; error: "unknown_adapter" | "not_found" };

export async function setEtfAdapter(
  input: { symbol: string; adapterKey: string | null },
  deps: Pick<EtfConfigDeps, "db" | "run" | "registry">,
): Promise<SetEtfAdapterResult> {
  if (input.adapterKey !== null && deps.registry.get(input.adapterKey) === undefined) {
    return { ok: false, error: "unknown_adapter" };
  }
  const [result] = await deps.run([
    deps.db.execute(
      sql`update "etfs" set "adapter_key" = ${input.adapterKey} where "symbol" = ${input.symbol} returning "id"`,
    ),
  ]);
  return rowsOf(result).length === 0 ? { ok: false, error: "not_found" } : { ok: true };
}

export type DetectEtfAdapterResult =
  | { ok: true; adapterKey: string | null; reason: DetectionReason }
  | { ok: false; error: "not_found" };

export async function detectEtfAdapter(
  input: { symbol: string },
  deps: Pick<EtfConfigDeps, "db" | "run" | "detect">,
): Promise<DetectEtfAdapterResult> {
  const [result] = await deps.run([
    deps.db.execute(sql`select "bvb_url" from "etfs" where "symbol" = ${input.symbol}`),
  ]);
  const rows = rowsOf(result);
  if (rows.length === 0) {
    return { ok: false, error: "not_found" };
  }
  const bvbUrl = String(rows[0].bvb_url);
  const detection = await deps.detect({ symbol: input.symbol, bvbUrl });
  await deps.run([
    deps.db.execute(sql`update "etfs" set "adapter_key" = ${detection.adapterKey} where "symbol" = ${input.symbol}`),
  ]);
  return { ok: true, adapterKey: detection.adapterKey, reason: detection.reason };
}
