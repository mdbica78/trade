import type { AdminActionState, AdminMessageKey } from "@/components/admin/action-state";
import type { MoveFieldResult, TrackFieldResult, UntrackFieldResult } from "@/lib/config/tracked-fields";

function errorState(messageKey: AdminMessageKey, symbol: string): AdminActionState {
  return { status: "error", messageKey, values: { symbol } };
}

export function trackResultToState(result: TrackFieldResult, symbol: string): AdminActionState {
  if (!result.ok) {
    return errorState(result.error === "not_found" ? "notFound" : "fieldNotAvailable", symbol);
  }
  return {
    status: "success",
    messageKey: result.action === "tracked" ? "fieldTracked" : "fieldAlreadyTracked",
    values: { symbol: result.symbol },
  };
}

export function untrackResultToState(result: UntrackFieldResult, symbol: string): AdminActionState {
  if (!result.ok) {
    return errorState(result.error === "not_found" ? "notFound" : "fieldNotTracked", symbol);
  }
  return { status: "success", messageKey: "fieldUntracked", values: { symbol: result.symbol } };
}

export function moveResultToState(result: MoveFieldResult, symbol: string): AdminActionState {
  if (!result.ok) {
    const messageKey: AdminMessageKey =
      result.error === "not_found"
        ? "notFound"
        : result.error === "not_tracked"
          ? "fieldNotTracked"
          : "invalidDirection";
    return errorState(messageKey, symbol);
  }
  return {
    status: "success",
    messageKey: result.moved ? "fieldMoved" : "fieldNotMoved",
    values: { symbol: result.symbol },
  };
}
