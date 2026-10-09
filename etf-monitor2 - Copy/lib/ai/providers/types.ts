export const PROVIDER_ERROR_CODES = [
  "timeout",
  "network",
  "auth_failed",
  "rate_limited",
  "model_not_found",
  "provider_error",
  "bad_response",
] as const;

export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];

export type GenerateRequest = { system: string; user: string; json: boolean; maxOutputTokens: number };

/** A local function type, not `typeof fetch`: keeps the global banned outside the wiring module and is easy to mock. */
export type ProviderFetch = (url: string, init: RequestInit) => Promise<Response>;

export type ProviderCallContext = { apiKey: string | null; model: string; fetch: ProviderFetch; signal: AbortSignal };

/** What a caller hands to `runGeneration` — everything in `ProviderCallContext` except the signal, which the wrapper owns. */
export type ProviderCallInput = Omit<ProviderCallContext, "signal">;

export type GenerateResult = { ok: true; text: string } | { ok: false; error: ProviderErrorCode };

/**
 * One AI-provider adapter (FR6 "a single AI-provider adapter, easy to swap"). An adapter must
 * never throw, must never put the key, a URL or the raw response body into its result, and makes
 * at most one HTTP request per call, only through `ctx.fetch`.
 */
export interface AiProvider {
  readonly id: string;
  generate(request: GenerateRequest, ctx: ProviderCallContext): Promise<GenerateResult>;
}
