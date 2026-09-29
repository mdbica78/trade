"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { createHomeDisplayConfigDeps } from "@/lib/config/default-deps";
import { saveHomeDisplay } from "@/lib/config/home-display";
import { logLoadError } from "@/lib/log/load-error";
import {
  type HomeDisplayActionResult,
  type HomeDisplaySaveInput,
} from "@/components/home-display-state";

export async function saveHomeDisplayAction(
  input: HomeDisplaySaveInput,
): Promise<HomeDisplayActionResult> {
  try {
    const result = await saveHomeDisplay(input, createHomeDisplayConfigDeps(getDb()));
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath("/");
    return { ok: true, display: result.display };
  } catch (error) {
    logLoadError("home/display-save", error);
    return { ok: false, error: "save_failed" };
  }
}
