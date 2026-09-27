import type { ProviderErrorCode } from "../../providers/types";

export const CONFIGURATION_ACTIONS = ["add_etf", "remove_etf", "track_field", "untrack_field"] as const;
export type ConfigurationAction = (typeof CONFIGURATION_ACTIONS)[number];

export type ConfigurationIntent =
  | { action: "add_etf"; symbol: string; name: string | null }
  | { action: "remove_etf"; symbol: string }
  | { action: "track_field"; symbol: string; field: string }
  | { action: "untrack_field"; symbol: string; field: string };

export const UNCLEAR_REASONS = [
  "malformed",
  "model_unclear",
  "symbol_not_in_message",
  "unknown_etf",
  "unknown_field",
  "not_tracked",
  "already_tracked",
] as const;
export type UnclearReason = (typeof UNCLEAR_REASONS)[number];

export type ConfigurationOutcome =
  | { kind: "intent"; intent: ConfigurationIntent }
  | { kind: "unsupported" }
  | { kind: "unclear"; reason: UnclearReason; symbol?: string; field?: string }
  | { kind: "multiple" }
  | { kind: "provider_error"; error: ProviderErrorCode };

/** Parser output, before grounding. Raw strings are unvalidated model output. */
export type ParsedOutput =
  | { kind: "action"; action: ConfigurationAction; symbol: string; name: string | null; field: string | null }
  | { kind: "unsupported" }
  | { kind: "unclear"; reason: "malformed" | "model_unclear" }
  | { kind: "multiple" };

const CONFIGURATION_ACTION_SET: ReadonlySet<string> = new Set(CONFIGURATION_ACTIONS);

const FENCE_RE = /^```[A-Za-z]*[ \t]*\r?\n([\s\S]*?)\r?\n?```$/;

function stripFence(text: string): string {
  const match = FENCE_RE.exec(text);
  if (match === null) return text;
  const inner = match[1] ?? "";
  if (inner.includes("```")) return text;
  return inner.trim();
}

function looksLikeMultiple(text: string): boolean {
  try {
    const wrapped = `[${text.replace(/}\s*,?\s*{/g, "},{")}]`;
    const parsed = JSON.parse(wrapped) as unknown;
    return (
      Array.isArray(parsed) &&
      parsed.length >= 2 &&
      parsed.every((item) => typeof item === "object" && item !== null && typeof (item as { action?: unknown }).action === "string")
    );
  } catch {
    return false;
  }
}

function parseObject(obj: Record<string, unknown>): ParsedOutput {
  if (typeof obj.action !== "string") {
    if (Array.isArray(obj.actions) && obj.actions.length >= 2) return { kind: "multiple" };
    return { kind: "unclear", reason: "malformed" };
  }
  const action = obj.action.trim().toLowerCase();

  if (action === "multiple") return { kind: "multiple" };
  if (action === "unsupported") return { kind: "unsupported" };
  if (action === "unclear") return { kind: "unclear", reason: "model_unclear" };
  if (!CONFIGURATION_ACTION_SET.has(action)) return { kind: "unsupported" };

  const typedAction = action as ConfigurationAction;
  if (typeof obj.symbol !== "string") return { kind: "unclear", reason: "malformed" };

  if (typedAction === "add_etf") {
    if (obj.name !== undefined && obj.name !== null && typeof obj.name !== "string") {
      return { kind: "unclear", reason: "malformed" };
    }
    const name = typeof obj.name === "string" ? obj.name : null;
    return { kind: "action", action: typedAction, symbol: obj.symbol, name, field: null };
  }

  if (typedAction === "track_field" || typedAction === "untrack_field") {
    if (typeof obj.field !== "string") return { kind: "unclear", reason: "malformed" };
    return { kind: "action", action: typedAction, symbol: obj.symbol, name: null, field: obj.field };
  }

  return { kind: "action", action: typedAction, symbol: obj.symbol, name: null, field: null };
}

/** Strict, never throws (sprint decisions 7, 9). Extra JSON properties are ignored. */
export function parseConfigurationOutput(text: string): ParsedOutput {
  try {
    const stripped = stripFence(text.trim());

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      return looksLikeMultiple(stripped) ? { kind: "multiple" } : { kind: "unclear", reason: "malformed" };
    }

    if (Array.isArray(parsed)) {
      return parsed.length === 0 ? { kind: "unclear", reason: "malformed" } : { kind: "multiple" };
    }
    if (typeof parsed !== "object" || parsed === null) {
      return { kind: "unclear", reason: "malformed" };
    }
    return parseObject(parsed as Record<string, unknown>);
  } catch {
    return { kind: "unclear", reason: "malformed" };
  }
}
