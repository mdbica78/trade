import type { AdminActionState, AdminMessageKey } from "@/components/admin/action-state";
import type {
  AddEtfResult,
  DetectEtfAdapterResult,
  SetEtfActiveResult,
  SetEtfAdapterResult,
} from "@/lib/config/etfs";

function errorState(messageKey: AdminMessageKey, values?: { symbol?: string }): AdminActionState {
  return { status: "error", messageKey, values };
}

export function addResultToState(result: AddEtfResult, symbol: string): AdminActionState {
  if (!result.ok) {
    if (result.error === "invalid_symbol") return errorState("invalidSymbol");
    if (result.error === "invalid_name") return errorState("invalidName");
    return errorState("alreadyMonitored", { symbol });
  }
  if (result.action === "reactivated") {
    return { status: "success", messageKey: "reactivated", values: { symbol: result.symbol } };
  }
  if (result.adapterKey === null) {
    return { status: "success", messageKey: "addedNoAdapter", values: { symbol: result.symbol } };
  }
  return {
    status: "success",
    messageKey: "added",
    values: { symbol: result.symbol, adapter: result.adapterKey },
  };
}

export function setActiveResultToState(result: SetEtfActiveResult, symbol: string, active: boolean): AdminActionState {
  if (!result.ok) {
    return errorState("notFound", { symbol });
  }
  return { status: "success", messageKey: active ? "activated" : "deactivated", values: { symbol } };
}

export function setAdapterResultToState(result: SetEtfAdapterResult, symbol: string): AdminActionState {
  if (!result.ok) {
    return errorState(result.error === "unknown_adapter" ? "unknownAdapter" : "notFound", { symbol });
  }
  return { status: "success", messageKey: "adapterSet", values: { symbol } };
}

export function detectResultToState(result: DetectEtfAdapterResult, symbol: string): AdminActionState {
  if (!result.ok) {
    return errorState("notFound", { symbol });
  }
  if (result.adapterKey === null) {
    return {
      status: "success",
      messageKey: "notDetected",
      values: { symbol },
      reason: result.reason as Exclude<typeof result.reason, "detected">,
    };
  }
  return {
    status: "success",
    messageKey: "detected",
    values: { symbol, adapter: result.adapterKey },
    reason: undefined,
  };
}
