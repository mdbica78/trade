import { addEtf, setEtfActive, type AddEtfResult, type EtfConfigDeps } from "../../../config/etfs";
import { trackField, untrackField } from "../../../config/tracked-fields";
import type { ContextField, ConfigurationContext } from "./context";
import type { ConfigurationIntent } from "./intent";

export const EXECUTION_CODES = [
  "added",
  "added_no_adapter",
  "reactivated",
  "already_monitored",
  "add_rejected",
  "removed",
  "already_inactive",
  "not_found",
  "tracked",
  "already_tracked",
  "field_not_available",
  "untracked",
  "not_tracked",
] as const;
export type ExecutionCode = (typeof EXECUTION_CODES)[number];

export function configurationOutcomeFailed(code: ExecutionCode): boolean {
  return code === "add_rejected" || code === "not_found" ||
    code === "field_not_available" || code === "not_tracked";
}

type NotDetectedReason = Exclude<Extract<AddEtfResult, { ok: true; action: "added" }>["reason"], "detected">;

export type ExecutionOutcome = {
  code: ExecutionCode;
  symbol: string;
  field: ContextField | null;
  adapterKey: string | null;
  detectionReason: NotDetectedReason | null;
  changed: boolean;
};

function fieldFromContext(context: ConfigurationContext, symbol: string, fieldKey: string): ContextField {
  const etf = context.etfs.find((e) => e.symbol === symbol);
  const found = etf?.available.find((f) => f.fieldKey === fieldKey) ?? etf?.tracked.find((f) => f.fieldKey === fieldKey);
  return found ?? { fieldKey, labelRo: fieldKey, labelEn: fieldKey };
}

function outcome(
  code: ExecutionCode,
  symbol: string,
  overrides: Partial<Pick<ExecutionOutcome, "field" | "adapterKey" | "detectionReason" | "changed">> = {},
): ExecutionOutcome {
  return {
    code,
    symbol,
    field: overrides.field ?? null,
    adapterKey: overrides.adapterKey ?? null,
    detectionReason: overrides.detectionReason ?? null,
    changed: overrides.changed ?? false,
  };
}

/**
 * Exactly one `lib/config/` call per intent. Contains no SQL; an exception propagates to the
 * caller (the chat entry module owns the catch, DEC-016 §2).
 */
export async function executeConfigurationIntent(
  intent: ConfigurationIntent,
  context: ConfigurationContext,
  deps: EtfConfigDeps,
): Promise<ExecutionOutcome> {
  switch (intent.action) {
    case "add_etf": {
      const result = await addEtf({ symbol: intent.symbol }, deps);
      if (!result.ok) {
        if (result.error === "already_monitored") return outcome("already_monitored", intent.symbol);
        return outcome("add_rejected", intent.symbol);
      }
      if (result.action === "reactivated") {
        return outcome("reactivated", intent.symbol, { changed: true });
      }
      if (result.adapterKey !== null) {
        return outcome("added", intent.symbol, { adapterKey: result.adapterKey, changed: true });
      }
      return outcome("added_no_adapter", intent.symbol, {
        detectionReason: result.reason as NotDetectedReason,
        changed: true,
      });
    }

    case "remove_etf": {
      const etf = context.etfs.find((e) => e.symbol === intent.symbol);
      const result = await setEtfActive({ symbol: intent.symbol, active: false }, deps);
      if (!result.ok) return outcome("not_found", intent.symbol);
      if (etf !== undefined && etf.isActive === false) return outcome("already_inactive", intent.symbol);
      return outcome("removed", intent.symbol, { changed: true });
    }

    case "track_field": {
      const result = await trackField({ symbol: intent.symbol, fieldKey: intent.field }, deps);
      const field = fieldFromContext(context, intent.symbol, intent.field);
      if (!result.ok) {
        return outcome(result.error === "not_found" ? "not_found" : "field_not_available", intent.symbol, { field });
      }
      if (result.action === "already_tracked") return outcome("already_tracked", intent.symbol, { field });
      return outcome("tracked", intent.symbol, { field, changed: true });
    }

    case "untrack_field": {
      const result = await untrackField({ symbol: intent.symbol, fieldKey: intent.field }, deps);
      const field = fieldFromContext(context, intent.symbol, intent.field);
      if (!result.ok) {
        return outcome(result.error === "not_found" ? "not_found" : "not_tracked", intent.symbol, { field });
      }
      return outcome("untracked", intent.symbol, { field, changed: true });
    }
  }
}
