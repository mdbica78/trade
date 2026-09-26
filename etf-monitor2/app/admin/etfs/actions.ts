"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { createEtfConfigDeps } from "@/lib/config/default-deps";
import { addEtf, detectEtfAdapter, setEtfActive, setEtfAdapter } from "@/lib/config/etfs";
import type { AdminActionState } from "@/components/admin/action-state";
import {
  addResultToState,
  detectResultToState,
  setActiveResultToState,
  setAdapterResultToState,
} from "./result-messages";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/etfs");
}

const GENERIC_ERROR: AdminActionState = { status: "error", messageKey: "genericError" };
const INVALID_REQUEST: AdminActionState = { status: "error", messageKey: "invalidRequest" };

export async function addEtfAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const symbol = formData.get("symbol");
  const name = formData.get("name");
  if (typeof symbol !== "string" || typeof name !== "string") {
    return INVALID_REQUEST;
  }
  try {
    const result = await addEtf({ symbol, name }, createEtfConfigDeps(getDb()));
    if (result.ok) revalidateAll();
    return addResultToState(result, symbol.trim().toUpperCase());
  } catch {
    return GENERIC_ERROR;
  }
}

export async function setEtfActiveAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const symbol = formData.get("symbol");
  const active = formData.get("active");
  if (typeof symbol !== "string" || (active !== "true" && active !== "false")) {
    return INVALID_REQUEST;
  }
  const activeBool = active === "true";
  try {
    const result = await setEtfActive({ symbol, active: activeBool }, createEtfConfigDeps(getDb()));
    if (result.ok) revalidateAll();
    return setActiveResultToState(result, symbol, activeBool);
  } catch {
    return GENERIC_ERROR;
  }
}

export async function setEtfAdapterAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const symbol = formData.get("symbol");
  const adapterKeyRaw = formData.get("adapterKey");
  if (typeof symbol !== "string" || typeof adapterKeyRaw !== "string") {
    return INVALID_REQUEST;
  }
  const adapterKey = adapterKeyRaw === "" ? null : adapterKeyRaw;
  try {
    const result = await setEtfAdapter({ symbol, adapterKey }, createEtfConfigDeps(getDb()));
    if (result.ok) revalidateAll();
    return setAdapterResultToState(result, symbol);
  } catch {
    return GENERIC_ERROR;
  }
}

export async function redetectEtfAdapterAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const symbol = formData.get("symbol");
  if (typeof symbol !== "string") {
    return INVALID_REQUEST;
  }
  try {
    const result = await detectEtfAdapter({ symbol }, createEtfConfigDeps(getDb()));
    if (result.ok) revalidateAll();
    return detectResultToState(result, symbol);
  } catch {
    return GENERIC_ERROR;
  }
}
