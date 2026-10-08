import { ANSWER_JSON_SCHEMA } from "./capabilities/action-list";
import type { StructuredOutputMode } from "./provider-catalog";
import { AI_PROVIDER_TIMEOUT_MS, runGeneration } from "./providers/run-generation";
import type { AiProvider, GenerateRequest, GenerateResult, ProviderCallInput } from "./providers/types";

/** DEC-027 §2/§3: the chat turn's own call budget, independent of each call's own 20 s timeout. */
export const MAX_MODEL_CALLS_PER_MESSAGE = 2;
export const MAX_MODEL_CALLS_WITH_DOWNGRADE = 3;
export const CHAT_MODEL_TIME_BUDGET_MS = 45_000;
export const MIN_MODEL_CALL_MS = 5_000;

export type FormatCache = {
  isDowngraded(key: string): boolean;
  markDowngraded(key: string): void;
};

export function createFormatCache(): FormatCache {
  const downgraded = new Set<string>();
  return {
    isDowngraded: (key) => downgraded.has(key),
    markDowngraded: (key) => {
      downgraded.add(key);
    },
  };
}

/** Process-lifetime cache: a provider+model pair that once needed a json_object fallback skips the json_schema attempt from then on. Server memory only (DEC-027 §2) — never persisted. */
export const DEFAULT_FORMAT_CACHE: FormatCache = createFormatCache();

export function formatCacheKey(providerId: string, model: string): string {
  return `${providerId}\n${model}`;
}

export type ModelCaller = {
  call(request: GenerateRequest): Promise<GenerateResult>;
  remaining(): number;
};

/**
 * Wraps one provider call behind the chat turn's shared call cap and time budget (T-4, T-8). The
 * `request` passed to `call` need not set `format`/`schema` meaningfully — this wrapper picks the
 * actual structured-output mode for each attempt. A `json_schema` call that comes back
 * `unsupported_format` is retried once as `json_object`, raising the cap to 3 only for that retry;
 * the provider+model pair is marked downgraded in `cache` only once the retry itself succeeds. A
 * second `unsupported_format` (the downgrade retry also rejected) is reported as `provider_error`,
 * never surfaced to the user as `unsupported_format` (T-18).
 */
export function createModelCaller(options: {
  provider: AiProvider;
  input: ProviderCallInput;
  mode: StructuredOutputMode;
  cache?: FormatCache;
  now?: () => number;
}): ModelCaller {
  const { provider, input, mode } = options;
  const cache = options.cache ?? DEFAULT_FORMAT_CACHE;
  const now = options.now ?? Date.now;
  const key = formatCacheKey(provider.id, input.model);
  const start = now();
  let calls = 0;
  let cap = MAX_MODEL_CALLS_PER_MESSAGE;

  function timeLeft(): number {
    return CHAT_MODEL_TIME_BUDGET_MS - (now() - start);
  }

  function attemptFormat(): { format: "json_schema" | "json_object" | "none"; schema?: typeof ANSWER_JSON_SCHEMA } {
    if (mode === "none") return { format: "none" };
    if (mode === "json_object") return { format: "json_object" };
    if (cache.isDowngraded(key)) return { format: "json_object" };
    return { format: "json_schema", schema: ANSWER_JSON_SCHEMA };
  }

  async function call(request: GenerateRequest): Promise<GenerateResult> {
    if (calls >= cap || timeLeft() < MIN_MODEL_CALL_MS) {
      return { ok: false, error: "timeout" };
    }
    const attempt = attemptFormat();
    calls += 1;
    const result = await runGeneration(
      provider,
      { ...request, format: attempt.format, schema: attempt.schema },
      input,
      { timeoutMs: Math.min(AI_PROVIDER_TIMEOUT_MS, timeLeft()) },
    );
    if (result.ok || result.error !== "unsupported_format" || attempt.format !== "json_schema") {
      return result;
    }

    if (cap < MAX_MODEL_CALLS_WITH_DOWNGRADE) cap = MAX_MODEL_CALLS_WITH_DOWNGRADE;
    if (calls >= cap || timeLeft() < MIN_MODEL_CALL_MS) {
      return { ok: false, error: "provider_error" };
    }
    calls += 1;
    const retry = await runGeneration(
      provider,
      { ...request, format: "json_object" },
      input,
      { timeoutMs: Math.min(AI_PROVIDER_TIMEOUT_MS, timeLeft()) },
    );
    if (retry.ok) {
      cache.markDowngraded(key);
      return retry;
    }
    if (retry.error === "unsupported_format") {
      return { ok: false, error: "provider_error" };
    }
    return retry;
  }

  function remaining(): number {
    if (timeLeft() < MIN_MODEL_CALL_MS) return 0;
    return Math.max(0, cap - calls);
  }

  return { call, remaining };
}
