import { sql } from "drizzle-orm";
import type { Db } from "../db/index";
import { rowsOf, type BatchRunner } from "../ingestion/store";

export const AI_MODEL_MAX_LENGTH = 200;

/** `model` is the active provider's model; `models` holds every provider's last saved model (DEC-029). */
export type AiSettings = { provider: string | null; model: string | null; models?: Readonly<Record<string, string>> };
export type AiSettingsDeps = {
  db: Db;
  run: BatchRunner;
  providerIds: readonly string[];
  loadCustomProviderIds?: () => Promise<readonly string[]>;
};
export type SetAiSettingsResult =
  | { ok: true; provider: string | null; model: string | null }
  | { ok: false; error: "unknown_provider" | "invalid_model" };

export async function getAiSettings(deps: Pick<AiSettingsDeps, "db" | "run">): Promise<AiSettings> {
  const [result] = await deps.run([
    deps.db.execute(sql`select "ai_provider", "ai_model", "ai_models" from "settings" where "id" = 1`),
  ]);
  const rows = rowsOf(result);
  if (rows.length === 0) {
    return { provider: null, model: null, models: {} };
  }
  const row = rows[0];
  const provider = row.ai_provider === null ? null : String(row.ai_provider);
  const models = parseModels(row.ai_models);
  // The legacy single column always belongs to the provider saved with it.
  if (provider !== null && row.ai_model !== null && models[provider] === undefined) {
    models[provider] = String(row.ai_model);
  }
  return {
    provider,
    model: provider === null ? (row.ai_model === null ? null : String(row.ai_model)) : (models[provider] ?? null),
    models,
  };
}

function parseModels(raw: unknown): Record<string, string> {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const models: Record<string, string> = {};
  for (const [key, model] of Object.entries(value)) {
    if (typeof model === "string") {
      models[key] = model;
    }
  }
  return models;
}

function normaliseOptionalText(raw: unknown, accept: (trimmed: string) => boolean): { ok: true; value: string | null } | { ok: false } {
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
  if (!accept(trimmed)) {
    return { ok: false };
  }
  return { ok: true, value: trimmed };
}

export async function setAiSettings(
  input: { provider: unknown; model: unknown },
  deps: AiSettingsDeps,
): Promise<SetAiSettingsResult> {
  const provider = normaliseOptionalText(input.provider, () => true);
  if (!provider.ok) {
    return { ok: false, error: "unknown_provider" };
  }
  if (provider.value !== null && !deps.providerIds.includes(provider.value)) {
    const customIds = deps.loadCustomProviderIds ? await deps.loadCustomProviderIds() : [];
    if (!customIds.includes(provider.value)) {
      return { ok: false, error: "unknown_provider" };
    }
  }

  // Clearing the provider also clears the model (story Task 2): the model is not validated in that case.
  let model: string | null;
  if (provider.value === null) {
    model = null;
  } else {
    const normalisedModel = normaliseOptionalText(input.model, (value) => value.length <= AI_MODEL_MAX_LENGTH);
    if (!normalisedModel.ok) {
      return { ok: false, error: "invalid_model" };
    }
    model = normalisedModel.value;
  }

  // One statement: the active pair plus this provider's own entry in the per-provider map. A blank
  // model removes the entry; other providers' entries are never touched.
  const entry = provider.value !== null && model !== null ? JSON.stringify({ [provider.value]: model }) : "{}";
  const entryKey = provider.value ?? "";
  await deps.run([
    deps.db.execute(
      sql`insert into "settings" ("id", "ai_provider", "ai_model", "ai_models")
          values (1, ${provider.value}, ${model}, ${entry}::jsonb)
          on conflict ("id") do update set "ai_provider" = excluded."ai_provider", "ai_model" = excluded."ai_model",
            "ai_models" = ((coalesce("settings"."ai_models", '{}'::jsonb)
              || case when "settings"."ai_provider" is not null and "settings"."ai_model" is not null
                        and not jsonb_exists(coalesce("settings"."ai_models", '{}'::jsonb), "settings"."ai_provider")
                      then jsonb_build_object("settings"."ai_provider", "settings"."ai_model") else '{}'::jsonb end)
              - ${entryKey}::text) || excluded."ai_models"`,
    ),
  ]);

  return { ok: true, provider: provider.value, model };
}
