import type { ProviderErrorCode } from "../providers/types";

export const MAX_ACTIONS_PER_MESSAGE = 5;

export type ParsedActionListOutcome =
  | { kind: "actions"; actions: readonly unknown[] }
  | { kind: "unsupported" }
  | { kind: "unclear"; reason: "malformed" | "model_unclear" }
  | { kind: "too_many" };

export type ActionListOutcome =
  | ParsedActionListOutcome
  | { kind: "provider_error"; error: ProviderErrorCode };

const FENCE_RE = /^```[A-Za-z]*[ \t]*\r?\n([\s\S]*?)\r?\n?```$/;

function stripFence(text: string): string {
  const match = FENCE_RE.exec(text);
  if (match === null || match[1]?.includes("```")) return text;
  return (match[1] ?? "").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Parse the shared JSON envelope without preserving arbitrary model text or properties. */
export function parseActionListOutput(text: string): ParsedActionListOutcome {
  try {
    const parsed: unknown = JSON.parse(stripFence(text.trim()));
    if (!isRecord(parsed)) return { kind: "unclear", reason: "malformed" };

    if (Object.keys(parsed).length === 1 && parsed.kind === "unsupported") {
      return { kind: "unsupported" };
    }
    if (Object.keys(parsed).length === 1 && parsed.kind === "unclear") {
      return { kind: "unclear", reason: "model_unclear" };
    }
    if (Object.keys(parsed).length === 1 && parsed.kind === "too_many") {
      return { kind: "too_many" };
    }
    if (Object.keys(parsed).length !== 1 || !Array.isArray(parsed.actions)) {
      return { kind: "unclear", reason: "malformed" };
    }
    if (parsed.actions.length > MAX_ACTIONS_PER_MESSAGE) return { kind: "too_many" };
    if (parsed.actions.length === 0 || parsed.actions.some((action) => !isRecord(action))) {
      return { kind: "unclear", reason: "malformed" };
    }
    return { kind: "actions", actions: parsed.actions };
  } catch {
    return { kind: "unclear", reason: "malformed" };
  }
}
