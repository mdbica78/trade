import {
  PROVIDER_ERROR_CODES,
  type AiProvider,
  type GenerateRequest,
  type GenerateResult,
  type ProviderCallInput,
  type ProviderErrorCode,
} from "./types";

/** Sprint 6 decision #6: one request, no retry, 20 seconds. */
export const AI_PROVIDER_TIMEOUT_MS = 20_000;

function normaliseResult(value: unknown): GenerateResult {
  const candidate = value as { ok?: unknown; text?: unknown; error?: unknown } | null | undefined;

  if (typeof candidate === "object" && candidate !== null) {
    if (candidate.ok === true && typeof candidate.text === "string") {
      return { ok: true, text: candidate.text };
    }
    if (candidate.ok === false && typeof candidate.error === "string" && (PROVIDER_ERROR_CODES as readonly string[]).includes(candidate.error)) {
      return { ok: false, error: candidate.error as ProviderErrorCode };
    }
  }
  // A malformed adapter result (or an unknown error code) is treated like a throw (DEC-017 §2).
  return { ok: false, error: "provider_error" };
}

/**
 * Every caller of an `AiProvider` goes through this wrapper (FR6; AGENTS.md secrets rule): it
 * owns the timeout and the abort signal, calls `generate` exactly once, and never throws — a
 * rejection, a synchronous throw, or a malformed result all become `{ ok: false, error: ... }`,
 * never carrying the caught value or an exception message.
 */
export async function runGeneration(
  provider: AiProvider,
  request: GenerateRequest,
  input: ProviderCallInput,
  options: { timeoutMs?: number } = {},
): Promise<GenerateResult> {
  const timeoutMs = options.timeoutMs ?? AI_PROVIDER_TIMEOUT_MS;
  const controller = new AbortController();
  const ctx = { ...input, signal: controller.signal };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<GenerateResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ ok: false, error: "timeout" });
    }, timeoutMs);
  });

  const callPromise: Promise<GenerateResult> = Promise.resolve()
    .then(() => provider.generate(request, ctx))
    .then(normaliseResult)
    .catch(() => ({ ok: false, error: "provider_error" }) as GenerateResult);

  try {
    return await Promise.race([callPromise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}
