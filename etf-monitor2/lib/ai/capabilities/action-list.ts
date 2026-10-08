import type { JsonSchema, ProviderErrorCode } from "../providers/types";
import { isRecord } from "../../config/widgets";
import { normaliseSymbol } from "../../config/etfs";
import type { ConfigurationContext } from "./configuration/context";

export const MAX_ACTIONS_PER_MESSAGE = 5;
export const ALL_ETFS = "*";

export type TargetFailure = {
  ok: false;
  reason: "all_not_allowed" | "no_active_etfs" | "etf_inactive" | "bad_slot";
  symbol?: string;
};

/**
 * Expands a `*` ("all ETFs") action into one shallow copy per active context ETF, rejects `*`
 * for add_etf/remove_etf and for a numeric slot, and rejects an explicitly named inactive ETF
 * for every action except add_etf/remove_etf (both already give a specific reply). Pure, never
 * throws; the input object is never mutated.
 */
export function resolveActionTargets(
  raw: Record<string, unknown>,
  context: ConfigurationContext,
): { ok: true; actions: readonly Record<string, unknown>[] } | TargetFailure {
  const isWidgets = raw.capability === "widgets";
  const key = isWidgets ? "etf" : "symbol";
  const value = raw[key];
  const action = raw.action;
  const isAddOrRemove = action === "add_etf" || action === "remove_etf";

  if (value === ALL_ETFS) {
    if (isAddOrRemove) return { ok: false, reason: "all_not_allowed" };
    if (isWidgets && (action === "widget_update" || action === "widget_clear") && typeof raw.slot === "number") {
      return { ok: false, reason: "bad_slot" };
    }
    const activeEtfs = context.etfs.filter((etf) => etf.isActive);
    if (activeEtfs.length === 0) return { ok: false, reason: "no_active_etfs" };
    return { ok: true, actions: activeEtfs.map((etf) => ({ ...raw, [key]: etf.symbol })) };
  }

  if (typeof value === "string" && !isAddOrRemove) {
    const symbol = normaliseSymbol(value);
    const etf = symbol === null ? undefined : context.etfs.find((e) => e.symbol === symbol);
    if (etf !== undefined && !etf.isActive) {
      return { ok: false, reason: "etf_inactive", symbol: etf.symbol };
    }
  }

  return { ok: true, actions: [raw] };
}

export type ParsedActionListOutcome =
  | { kind: "actions"; actions: readonly unknown[]; reply?: string }
  | { kind: "answer"; reply: string | null; question: string | null }
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

export const REPLY_MAX_CHARS = 600;
export const QUESTION_MAX_CHARS = 300;

function lastWhitespaceIndex(text: string): number {
  let index = -1;
  for (let i = 0; i < text.length; i++) {
    if (/\s/.test(text[i])) index = i;
  }
  return index;
}

/** Cuts `text` to at most `max` characters, preferring a word boundary, ending with `…`. */
export function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  let truncated = text.slice(0, max - 1);
  const lastSpace = lastWhitespaceIndex(truncated);
  if (lastSpace > max / 2) {
    truncated = truncated.slice(0, lastSpace);
  }
  return `${truncated.trimEnd()}…`;
}

const WIDGET_DEFINITION_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    operation: { type: ["string", "null"] },
    fieldKey: { type: ["string", "null"] },
    periodUnit: { type: ["string", "null"] },
    periodAmount: { type: ["integer", "null"] },
    title: { type: ["string", "null"] },
  },
};

const ACTION_ITEM_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    capability: { type: "string", enum: ["configuration", "widgets"] },
    action: { type: "string" },
    symbol: { type: ["string", "null"] },
    etf: { type: ["string", "null"] },
    field: { type: ["string", "null"] },
    name: { type: ["string", "null"] },
    slot: { type: ["integer", "string", "null"] },
    definition: WIDGET_DEFINITION_SCHEMA,
    changes: WIDGET_DEFINITION_SCHEMA,
    match: WIDGET_DEFINITION_SCHEMA,
    definitions: { type: "array", items: WIDGET_DEFINITION_SCHEMA },
  },
};

/**
 * DEC-027 §2: the neutral JSON Schema sent to a provider in `json_schema` mode. Covers the shared
 * envelope only — action shapes stay open (`additionalProperties` is not restricted on them) since
 * one strict union schema per closed-action-set combination would be too large (T-1). The server
 * validator (`parseActionListOutput` + each capability's own strict parser) is the real gate either
 * way; this schema only improves the odds of a well-formed answer.
 */
export const ANSWER_JSON_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    reply: { type: ["string", "null"] },
    actions: { type: "array", maxItems: MAX_ACTIONS_PER_MESSAGE, items: ACTION_ITEM_SCHEMA },
    question: { type: ["string", "null"] },
  },
  required: ["reply", "actions", "question"],
  additionalProperties: false,
};

/**
 * Drops top-level keys whose value is `null` (a json-schema answer may emit them for every
 * optional property), except `name` — `add_etf`'s `name: null` is a meaningful "no name given"
 * value, not an absent key. Also strips `null` entries inside `definition`/`changes`/`match` and
 * each `definitions[]` entry. Pure, never mutates its input.
 */
export function stripSchemaNulls(action: Record<string, unknown>): Record<string, unknown> {
  const dropNulls = (value: Record<string, unknown>, keep: ReadonlySet<string> = new Set()): Record<string, unknown> =>
    Object.fromEntries(Object.entries(value).filter(([key, v]) => v !== null || keep.has(key)));

  const NESTED_OBJECT_KEYS = ["definition", "changes", "match"] as const;
  const result = dropNulls(action, new Set(["name"]));

  for (const key of NESTED_OBJECT_KEYS) {
    const nested = result[key];
    if (isRecord(nested)) {
      result[key] = dropNulls(nested);
    }
  }
  const definitions = result.definitions;
  if (Array.isArray(definitions)) {
    result.definitions = definitions.map((item) => (isRecord(item) ? dropNulls(item) : item));
  }
  return result;
}

const ENVELOPE_KEYS = new Set(["reply", "actions", "question"]);

function parseTextField(value: unknown, max: number): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.trim();
  if (trimmed === "") return { ok: true, value: null };
  return { ok: true, value: cutAtWord(trimmed, max) };
}

/** Parse the shared JSON envelope without preserving arbitrary model text or properties. */
export function parseActionListOutput(text: string): ParsedActionListOutcome {
  try {
    const parsed: unknown = JSON.parse(stripFence(text.trim()));
    if (!isRecord(parsed)) return { kind: "unclear", reason: "malformed" };

    const keys = Object.keys(parsed);

    if (keys.length === 1 && parsed.kind === "unsupported") {
      return { kind: "unsupported" };
    }
    if (keys.length === 1 && parsed.kind === "unclear") {
      return { kind: "unclear", reason: "model_unclear" };
    }
    if (keys.length === 1 && parsed.kind === "too_many") {
      return { kind: "too_many" };
    }

    if (keys.length === 0 || !keys.every((key) => ENVELOPE_KEYS.has(key))) {
      return { kind: "unclear", reason: "malformed" };
    }

    const reply = parseTextField(parsed.reply, REPLY_MAX_CHARS);
    if (!reply.ok) return { kind: "unclear", reason: "malformed" };
    const question = parseTextField(parsed.question, QUESTION_MAX_CHARS);
    if (!question.ok) return { kind: "unclear", reason: "malformed" };

    if ("actions" in parsed && parsed.actions !== undefined && !Array.isArray(parsed.actions)) {
      return { kind: "unclear", reason: "malformed" };
    }
    const actions = Array.isArray(parsed.actions) ? parsed.actions : [];

    if (actions.length > MAX_ACTIONS_PER_MESSAGE) return { kind: "too_many" };
    if (actions.some((action) => !isRecord(action))) return { kind: "unclear", reason: "malformed" };

    if (question.value !== null) {
      return { kind: "answer", reply: reply.value, question: question.value };
    }
    if (actions.length > 0) {
      return { kind: "actions", actions, ...(reply.value === null ? {} : { reply: reply.value }) };
    }
    if (reply.value !== null) {
      return { kind: "answer", reply: reply.value, question: null };
    }
    return { kind: "unclear", reason: "malformed" };
  } catch {
    return { kind: "unclear", reason: "malformed" };
  }
}
