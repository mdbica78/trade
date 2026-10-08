import { PROVIDER_ERROR_CODES, type GenerateResult, type ProviderCallContext, type ProviderErrorCode } from "./types";

/** A provider-specific rule for a non-2xx answer; null falls through to mapHttpStatus. Reads code fields only. */
export type ErrorBodyRule = (status: number, errorBody: unknown) => ProviderErrorCode | null;

export type ProviderHttpCall = {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  errorBodyRule: ErrorBodyRule | null;
  extractText: (json: unknown) => string | null;
  unsupportedFormatStatuses?: readonly number[];
};

/** 401/403 -> auth_failed; 404 -> model_not_found; 429 -> rate_limited; anything else -> provider_error. */
export function mapHttpStatus(status: number): ProviderErrorCode {
  if (status === 401 || status === 403) return "auth_failed";
  if (status === 404) return "model_not_found";
  if (status === 429) return "rate_limited";
  return "provider_error";
}

function isKnownErrorCode(value: unknown): value is ProviderErrorCode {
  return typeof value === "string" && (PROVIDER_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * The one place every adapter sends its HTTP call through (sprint decision 6: one request, no
 * retry). Never throws — a throwing `extractText`/`errorBodyRule` is caught by the outer `try`
 * and becomes `provider_error`. No key, URL, status text or body fragment ever reaches the result.
 */
export async function sendProviderRequest(call: ProviderHttpCall, ctx: ProviderCallContext): Promise<GenerateResult> {
  try {
    let response: Response;
    try {
      response = await ctx.fetch(call.url, {
        method: "POST",
        headers: call.headers,
        body: JSON.stringify(call.body),
        signal: ctx.signal,
        redirect: "error",
      });
    } catch {
      return { ok: false, error: ctx.signal.aborted ? "timeout" : "network" };
    }

    if (!response.ok) {
      let parsed: unknown = null;
      try {
        const text = await response.text();
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
      const ruleResult = call.errorBodyRule?.(response.status, parsed) ?? null;
      if (isKnownErrorCode(ruleResult)) {
        return { ok: false, error: ruleResult };
      }
      if (call.unsupportedFormatStatuses?.includes(response.status)) {
        return { ok: false, error: "unsupported_format" };
      }
      return { ok: false, error: mapHttpStatus(response.status) };
    }

    let text: string;
    try {
      text = await response.text();
    } catch {
      return { ok: false, error: ctx.signal.aborted ? "timeout" : "network" };
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, error: "bad_response" };
    }

    const extracted = call.extractText(json);
    if (typeof extracted !== "string" || extracted.trim() === "") {
      return { ok: false, error: "bad_response" };
    }

    return { ok: true, text: extracted };
  } catch {
    return { ok: false, error: "provider_error" };
  }
}
