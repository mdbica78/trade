"use server";

import { getDb } from "@/lib/db";
import { createEtfConfigDeps } from "@/lib/config/default-deps";
import { moveField, trackField, untrackField } from "@/lib/config/tracked-fields";
import type { AdminActionState } from "@/components/admin/action-state";
import { INVALID_REQUEST, runAdminAction } from "../../../run-action";
import { moveResultToState, trackResultToState, untrackResultToState } from "./result-messages";

export async function trackFieldAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const symbol = formData.get("symbol");
  const fieldKey = formData.get("fieldKey");
  if (typeof symbol !== "string" || typeof fieldKey !== "string") {
    return INVALID_REQUEST;
  }
  return runAdminAction(
    () => trackField({ symbol, fieldKey }, createEtfConfigDeps(getDb())),
    (result) => trackResultToState(result, symbol),
    (result) => (result.ok ? ["/", `/etf/${result.symbol}`, `/admin/etfs/${result.symbol}/fields`] : []),
  );
}

export async function untrackFieldAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const symbol = formData.get("symbol");
  const fieldKey = formData.get("fieldKey");
  if (typeof symbol !== "string" || typeof fieldKey !== "string") {
    return INVALID_REQUEST;
  }
  return runAdminAction(
    () => untrackField({ symbol, fieldKey }, createEtfConfigDeps(getDb())),
    (result) => untrackResultToState(result, symbol),
    (result) => (result.ok ? ["/", `/etf/${result.symbol}`, `/admin/etfs/${result.symbol}/fields`] : []),
  );
}

export async function moveFieldAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const symbol = formData.get("symbol");
  const fieldKey = formData.get("fieldKey");
  const direction = formData.get("direction");
  if (typeof symbol !== "string" || typeof fieldKey !== "string") {
    return INVALID_REQUEST;
  }
  return runAdminAction(
    () => moveField({ symbol, fieldKey, direction }, createEtfConfigDeps(getDb())),
    (result) => moveResultToState(result, symbol),
    (result) => (result.ok ? ["/", `/etf/${result.symbol}`, `/admin/etfs/${result.symbol}/fields`] : []),
  );
}
