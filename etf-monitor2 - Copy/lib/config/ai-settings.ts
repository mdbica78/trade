import { sql } from "drizzle-orm";
import type { Db } from "../db/index";
import { rowsOf, type BatchRunner } from "../ingestion/store";

export const AI_MODEL_MAX_LENGTH = 200;

export type AiSettings = { provider: string | null; model: string | null };
export type AiSettingsDeps = { db: Db; run: BatchRunner; providerIds: readonly string[] };
export type SetAiSettingsResult =
  | { ok: true; provider: string | null; model: string | null }
  | { ok: false; error: "unknown_provider" | "invalid_model" };

export async function getAiSettings(deps: Pick<AiSettingsDeps, "db" | "run">): Promise<AiSettings> {
  const [result] = await deps.run([
    deps.db.execute(sql`select "ai_provider", "ai_model" from "settings" where "id" = 1`),
  ]);
  const rows = rowsOf(result);
  if (rows.length === 0) {
    return { provider: null, model: null };
  }
  const row = rows[0];
  return {
    provider: row.ai_provider === null ? null : String(row.ai_provider),
    model: row.ai_model === null ? null : String(row.ai_model),
  };
}

function normaliseProvider(raw: unknown, providerIds: readonly string[]): { ok: true; value: string | null } | { ok: false } {
  if (raw === null || raw === undefined) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, value: null };
  }
  if (!providerIds.includes(trimmed)) {
    return { ok: false };
  }
  return { ok: true, value: trimmed };
}

function normaliseModel(raw: unknown): { ok: true; value: string | null } | { ok: false } {
  if (raw === null || raw === undefined) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, value: null };
  }
  if (trimmed.length > AI_MODEL_MAX_LENGTH) {
    return { ok: false };
  }
  return { ok: true, value: trimmed };
}

export async function setAiSettings(
  input: { provider: unknown; model: unknown },
  deps: AiSettingsDeps,
): Promise<SetAiSettingsResult> {
  const provider = normaliseProvider(input.provider, deps.providerIds);
  if (!provider.ok) {
    return { ok: false, error: "unknown_provider" };
  }

  // Clearing the provider also clears the model (story Task 2): the model is not validated in that case.
  let model: string | null;
  if (provider.value === null) {
    model = null;
  } else {
    const normalisedModel = normaliseModel(input.model);
    if (!normalisedModel.ok) {
      return { ok: false, error: "invalid_model" };
    }
    model = normalisedModel.value;
  }

  await deps.run([
    deps.db.execute(
      sql`insert into "settings" ("id", "ai_provider", "ai_model") values (1, ${provider.value}, ${model})
          on conflict ("id") do update set "ai_provider" = excluded."ai_provider", "ai_model" = excluded."ai_model"`,
    ),
  ]);

  return { ok: true, provider: provider.value, model };
}
