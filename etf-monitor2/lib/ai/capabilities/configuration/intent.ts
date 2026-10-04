import type { ProviderErrorCode } from "../../providers/types";
import type { ParsedActionListOutcome } from "../action-list";

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
  | { kind: "provider_error"; error: ProviderErrorCode }
  | { kind: "too_many" };

/** Raw, structurally checked configuration action before grounding. */
export type ParsedOutput =
  | { kind: "action"; action: ConfigurationAction; symbol: string; name: string | null; field: string | null }
  | { kind: "unsupported" }
  | { kind: "unclear"; reason: "malformed" | "model_unclear" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

/** Parses one tagged action and closes its schema before any grounding or execution. */
export function parseConfigurationAction(value: unknown): ParsedOutput {
  if (!isRecord(value) || value.capability !== "configuration" || typeof value.action !== "string") {
    return { kind: "unclear", reason: "malformed" };
  }
  const action = value.action.trim().toLowerCase();
  if (action === "unsupported" && hasOnlyKeys(value, ["capability", "action"])) return { kind: "unsupported" };
  if (action === "unclear" && hasOnlyKeys(value, ["capability", "action"])) {
    return { kind: "unclear", reason: "model_unclear" };
  }
  if (!(CONFIGURATION_ACTIONS as readonly string[]).includes(action)) {
    return { kind: "unclear", reason: "malformed" };
  }
  const typedAction = action as ConfigurationAction;
  if (typeof value.symbol !== "string") return { kind: "unclear", reason: "malformed" };

  if (typedAction === "add_etf") {
    if (!hasOnlyKeys(value, ["capability", "action", "symbol", "name"]) ||
        (value.name !== undefined && value.name !== null && typeof value.name !== "string")) {
      return { kind: "unclear", reason: "malformed" };
    }
    return {
      kind: "action",
      action: typedAction,
      symbol: value.symbol,
      name: typeof value.name === "string" ? value.name : null,
      field: null,
    };
  }
  if (typedAction === "track_field" || typedAction === "untrack_field") {
    if (!hasOnlyKeys(value, ["capability", "action", "symbol", "field"]) || typeof value.field !== "string") {
      return { kind: "unclear", reason: "malformed" };
    }
    return { kind: "action", action: typedAction, symbol: value.symbol, name: null, field: value.field };
  }
  if (!hasOnlyKeys(value, ["capability", "action", "symbol"])) return { kind: "unclear", reason: "malformed" };
  return { kind: "action", action: typedAction, symbol: value.symbol, name: null, field: null };
}

/** Kept as a single-action parser for focused unit tests; chat uses the common envelope parser. */
export function parseConfigurationOutput(text: string): ParsedOutput {
  try {
    const parsed: unknown = JSON.parse(text.trim());
    return parseConfigurationAction(parsed);
  } catch {
    return { kind: "unclear", reason: "malformed" };
  }
}

export type ConfigurationActionListOutcome = ParsedActionListOutcome;
