import { isRecord, hasOnlyKeys } from "../../../config/widgets";

export const CONFIGURATION_ACTIONS = ["add_etf", "remove_etf", "track_field", "untrack_field"] as const;
export type ConfigurationAction = (typeof CONFIGURATION_ACTIONS)[number];

export type ConfigurationIntent =
  | { action: "add_etf"; symbol: string }
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
  | { kind: "unclear"; reason: UnclearReason; symbol?: string; field?: string };

/** Raw, structurally checked configuration action before grounding. */
export type ParsedOutput =
  | { kind: "action"; action: ConfigurationAction; symbol: string; field: string | null }
  | { kind: "unclear"; reason: "malformed" };

/** Parses one tagged action and closes its schema before any grounding or execution. */
export function parseConfigurationAction(value: unknown): ParsedOutput {
  if (!isRecord(value) || value.capability !== "configuration" || typeof value.action !== "string") {
    return { kind: "unclear", reason: "malformed" };
  }
  if (!(CONFIGURATION_ACTIONS as readonly string[]).includes(value.action)) {
    return { kind: "unclear", reason: "malformed" };
  }
  const typedAction = value.action as ConfigurationAction;
  if (typeof value.symbol !== "string") return { kind: "unclear", reason: "malformed" };

  if (typedAction === "add_etf") {
    // A model-supplied name is tolerated (older prompts/models send one) but never read: the name comes from BVB.
    if (!hasOnlyKeys(value, ["capability", "action", "symbol", "name"]) ||
        (value.name !== undefined && value.name !== null && typeof value.name !== "string")) {
      return { kind: "unclear", reason: "malformed" };
    }
    return { kind: "action", action: typedAction, symbol: value.symbol, field: null };
  }
  if (typedAction === "track_field" || typedAction === "untrack_field") {
    if (!hasOnlyKeys(value, ["capability", "action", "symbol", "field"]) || typeof value.field !== "string") {
      return { kind: "unclear", reason: "malformed" };
    }
    return { kind: "action", action: typedAction, symbol: value.symbol, field: value.field };
  }
  if (!hasOnlyKeys(value, ["capability", "action", "symbol"])) return { kind: "unclear", reason: "malformed" };
  return { kind: "action", action: typedAction, symbol: value.symbol, field: null };
}
