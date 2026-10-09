"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { createEtfConfigDeps } from "@/lib/config/default-deps";
import { moveField, trackField, untrackField } from "@/lib/config/tracked-fields";
import type { AdminActionState } from "@/components/admin/action-state";
import { moveResultToState, trackResultToState, untrackResultToState } from "./result-messages";

function revalidateAll(symbol: string) {
  revalidatePath("/");
  revalidatePath(`/etf/${symbol}`);
  revalidatePath(`/admin/etfs/${symbol}/fields`);
}

const GENERIC_ERROR: AdminActionState = { status: "error", messageKey: "genericError" };
const INVALID_REQUEST: AdminActionState = { status: "error", messageKey: "invalidRequest" };

export async function trackFieldAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const symbol = formData.get("symbol");
  const fieldKey = formData.get("fieldKey");
  if (typeof symbol !== "string" || typeof fieldKey !== "string") {
    return INVALID_REQUEST;
  }
  try {
    const result = await trackField({ symbol, fieldKey }, createEtfConfigDeps(getDb()));
    if (result.ok) revalidateAll(result.symbol);
    return trackResultToState(result, symbol);
  } catch {
    return GENERIC_ERROR;
  }
}

export async function untrackFieldAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const symbol = formData.get("symbol");
  const fieldKey = formData.get("fieldKey");
  if (typeof symbol !== "string" || typeof fieldKey !== "string") {
    return INVALID_REQUEST;
  }
  try {
    const result = await untrackField({ symbol, fieldKey }, createEtfConfigDeps(getDb()));
    if (result.ok) revalidateAll(result.symbol);
    return untrackResultToState(result, symbol);
  } catch {
    return GENERIC_ERROR;
  }
}

export async function moveFieldAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const symbol = formData.get("symbol");
  const fieldKey = formData.get("fieldKey");
  const direction = formData.get("direction");
  if (typeof symbol !== "string" || typeof fieldKey !== "string" || (direction !== "up" && direction !== "down")) {
    return INVALID_REQUEST;
  }
  try {
    const result = await moveField({ symbol, fieldKey, direction }, createEtfConfigDeps(getDb()));
    if (result.ok) revalidateAll(result.symbol);
    return moveResultToState(result, symbol);
  } catch {
    return GENERIC_ERROR;
  }
}
