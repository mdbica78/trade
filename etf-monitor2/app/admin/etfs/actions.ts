"use server";

import { getDb } from "@/lib/db";
import { createEtfConfigDeps } from "@/lib/config/default-deps";
import { addEtf, detectEtfAdapter, normaliseSymbol, setEtfActive, setEtfAdapter } from "@/lib/config/etfs";
import type { AdminActionState } from "@/components/admin/action-state";
import { INVALID_REQUEST, runAdminAction } from "../run-action";
import {
  addResultToState,
  detectResultToState,
  setActiveResultToState,
  setAdapterResultToState,
} from "./result-messages";

export async function addEtfAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const symbol = formData.get("symbol");
  if (typeof symbol !== "string") {
    return INVALID_REQUEST;
  }
  const normalizedSymbol = normaliseSymbol(symbol);
  return runAdminAction(
    () => addEtf({ symbol }, createEtfConfigDeps(getDb())),
    (result) => addResultToState(result, normalizedSymbol ?? ""),
    (result) => (result.ok ? ["/", "/admin/etfs"] : []),
  );
}

export async function setEtfActiveAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const symbol = formData.get("symbol");
  const active = formData.get("active");
  if (typeof symbol !== "string" || (active !== "true" && active !== "false")) {
    return INVALID_REQUEST;
  }
  const activeBool = active === "true";
  return runAdminAction(
    () => setEtfActive({ symbol, active: activeBool }, createEtfConfigDeps(getDb())),
    (result) => setActiveResultToState(result, symbol, activeBool),
    (result) => (result.ok ? ["/", "/admin/etfs"] : []),
  );
}

export async function setEtfAdapterAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const symbol = formData.get("symbol");
  const adapterKeyRaw = formData.get("adapterKey");
  if (typeof symbol !== "string" || typeof adapterKeyRaw !== "string") {
    return INVALID_REQUEST;
  }
  const adapterKey = adapterKeyRaw === "" ? null : adapterKeyRaw;
  return runAdminAction(
    () => setEtfAdapter({ symbol, adapterKey }, createEtfConfigDeps(getDb())),
    (result) => setAdapterResultToState(result, symbol),
    (result) => (result.ok ? ["/", "/admin/etfs"] : []),
  );
}

export async function redetectEtfAdapterAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const symbol = formData.get("symbol");
  if (typeof symbol !== "string") {
    return INVALID_REQUEST;
  }
  return runAdminAction(
    () => detectEtfAdapter({ symbol }, createEtfConfigDeps(getDb())),
    (result) => detectResultToState(result, symbol),
    (result) => (result.ok ? ["/", "/admin/etfs"] : []),
  );
}
