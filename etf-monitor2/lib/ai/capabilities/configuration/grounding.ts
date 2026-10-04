import { normaliseName, normaliseSymbol } from "../../../config/etfs";
import type { ConfigurationContext } from "./context";
import type { ConfigurationOutcome, ParsedOutput } from "./intent";

const TOKEN_RE = new RegExp("[\\p{L}\\p{N}]+", "gu");

/** Letters and digits (any script) form one token; `message` is compared upper-cased. */
export function messageTokens(message: string): Set<string> {
  return new Set(message.toUpperCase().match(TOKEN_RE) ?? []);
}

/** Only `kind: "action"` is grounded; the other parser kinds map 1:1 to an outcome. */
export function groundAction(parsed: ParsedOutput, message: string, context: ConfigurationContext): ConfigurationOutcome {
  if (parsed.kind === "unsupported") return { kind: "unsupported" };
  if (parsed.kind === "unclear") return { kind: "unclear", reason: parsed.reason };

  const symbol = normaliseSymbol(parsed.symbol);

  if (parsed.action === "add_etf") {
    if (symbol === null || !messageTokens(message).has(symbol)) {
      return { kind: "unclear", reason: "symbol_not_in_message" };
    }
    const name = normaliseName(parsed.name);
    const keptName = name !== null && message.includes(name) ? name : null;
    return { kind: "intent", intent: { action: "add_etf", symbol, name: keptName } };
  }

  const etf = symbol === null ? undefined : context.etfs.find((e) => e.symbol === symbol);
  if (symbol === null || etf === undefined) {
    return { kind: "unclear", reason: "unknown_etf" };
  }

  if (parsed.action === "remove_etf") {
    return { kind: "intent", intent: { action: "remove_etf", symbol } };
  }

  const field = (parsed.field ?? "").trim().toLowerCase();

  if (parsed.action === "track_field") {
    const isAvailable = etf.available.some((f) => f.fieldKey === field);
    if (!isAvailable) return { kind: "unclear", reason: "unknown_field" };
    const isTracked = etf.tracked.some((f) => f.fieldKey === field);
    if (isTracked) return { kind: "unclear", reason: "already_tracked", symbol, field };
    return { kind: "intent", intent: { action: "track_field", symbol, field } };
  }

  // untrack_field
  const isTracked = etf.tracked.some((f) => f.fieldKey === field);
  if (isTracked) {
    return { kind: "intent", intent: { action: "untrack_field", symbol, field } };
  }
  const knownAnywhere = context.etfs.some(
    (e) => e.available.some((f) => f.fieldKey === field) || e.tracked.some((f) => f.fieldKey === field),
  );
  return knownAnywhere ? { kind: "unclear", reason: "not_tracked", symbol, field } : { kind: "unclear", reason: "unknown_field" };
}
