import { normaliseSymbol } from "../../../config/etfs";
import {
  isRecord,
  hasOnlyKeys,
  mergeWidgetChanges,
  validSlot,
  validateWidgetDefinition,
  MAX_WIDGETS_PER_ETF,
  WIDGET_OPERATIONS,
  WIDGET_PERIOD_UNITS,
  type Widget,
  type WidgetDefinition,
} from "../../../config/widgets";
import type { WidgetContext } from "./context";

export type WidgetIntent =
  | { action: "widget_add"; symbol: string; definition: WidgetDefinition }
  | { action: "widget_update"; symbol: string; slot: number; changes: Partial<WidgetDefinition> }
  | { action: "widget_update"; symbol: string; slots: readonly number[]; changes: Partial<WidgetDefinition> }
  | { action: "widget_clear"; symbol: string; slot: number | "all" }
  | { action: "widget_clear"; symbol: string; slots: readonly number[] }
  | { action: "widget_replace"; symbol: string; definitions: readonly WidgetDefinition[] };

export type WidgetIntentError =
  | "malformed"
  | "unknown_etf"
  | "unknown_operation"
  | "unknown_field"
  | "bad_period"
  | "bad_title"
  | "bad_slot"
  | "too_many";

export type WidgetIntentResult = { ok: true; intent: WidgetIntent } | { ok: false; reason: WidgetIntentError };

export type WidgetMatch = {
  operation?: WidgetDefinition["operation"];
  fieldKey?: string;
  periodUnit?: WidgetDefinition["periodUnit"];
  periodAmount?: number;
};

const CONFIG_KEYS = ["capability", "action", "etf", "definition", "slot", "changes", "definitions", "match"] as const;
const CHANGE_KEYS = ["operation", "fieldKey", "periodUnit", "periodAmount", "title"] as const;
const MATCH_KEYS = ["operation", "fieldKey", "periodUnit", "periodAmount"] as const;

function etfState(symbol: string, context: WidgetContext) {
  return context.etfs.find((etf) => etf.symbol === symbol);
}

/** Strictly parses a `match` object: 1-4 of operation/fieldKey/periodUnit/periodAmount, no catalogue check. */
function parseWidgetMatch(value: unknown): { ok: true; match: WidgetMatch } | { ok: false; reason: WidgetIntentError } {
  if (!isRecord(value) || !hasOnlyKeys(value, MATCH_KEYS) || Object.keys(value).length === 0) {
    return { ok: false, reason: "malformed" };
  }
  if (value.operation !== undefined && !(WIDGET_OPERATIONS as readonly unknown[]).includes(value.operation)) {
    return { ok: false, reason: "unknown_operation" };
  }
  if (value.fieldKey !== undefined && (typeof value.fieldKey !== "string" || value.fieldKey === "")) {
    return { ok: false, reason: "malformed" };
  }
  if (value.periodUnit !== undefined && !(WIDGET_PERIOD_UNITS as readonly unknown[]).includes(value.periodUnit)) {
    return { ok: false, reason: "bad_period" };
  }
  if (value.periodAmount !== undefined &&
      (!Number.isInteger(value.periodAmount) || Number(value.periodAmount) < 1 || Number(value.periodAmount) > 365)) {
    return { ok: false, reason: "bad_period" };
  }
  return {
    ok: true,
    match: {
      ...(value.operation === undefined ? {} : { operation: value.operation as WidgetDefinition["operation"] }),
      ...(value.fieldKey === undefined ? {} : { fieldKey: value.fieldKey as string }),
      ...(value.periodUnit === undefined ? {} : { periodUnit: value.periodUnit as WidgetDefinition["periodUnit"] }),
      ...(value.periodAmount === undefined ? {} : { periodAmount: value.periodAmount as number }),
    },
  };
}

/** Widgets equal on every key given in `match`, in slot order; an absent key is never compared. */
function matchingSlots(widgets: readonly Widget[], match: WidgetMatch): number[] {
  return widgets
    .filter((widget) =>
      (match.operation === undefined || widget.operation === match.operation) &&
      (match.fieldKey === undefined || widget.fieldKey === match.fieldKey) &&
      (match.periodUnit === undefined || widget.periodUnit === match.periodUnit) &&
      (match.periodAmount === undefined || widget.periodAmount === match.periodAmount))
    .map((widget) => widget.slot)
    .sort((a, b) => a - b);
}

function validateDefinition(value: unknown, etf: NonNullable<ReturnType<typeof etfState>>): WidgetIntentResult | WidgetDefinition {
  const result = validateWidgetDefinition(value, etf.available.map((field) => ({ fieldKey: field.fieldKey, numeric: true })));
  return result.ok ? result.value : { ok: false, reason: result.error };
}

/** Strictly parses and preflights one widget action against the unchanged pre-execution state. */
export function validateWidgetAction(raw: unknown, context: WidgetContext): WidgetIntentResult {
  if (!isRecord(raw) || raw.capability !== "widgets" || typeof raw.action !== "string" ||
      !hasOnlyKeys(raw, CONFIG_KEYS) || typeof raw.etf !== "string") {
    return { ok: false, reason: "malformed" };
  }
  const symbol = normaliseSymbol(raw.etf);
  if (symbol === null) return { ok: false, reason: "unknown_etf" };
  const etf = etfState(symbol, context);
  if (etf === undefined) return { ok: false, reason: "unknown_etf" };

  if (raw.action === "widget_add") {
    if (!hasOnlyKeys(raw, ["capability", "action", "etf", "definition"])) {
      return { ok: false, reason: "malformed" };
    }
    const definition = validateDefinition(raw.definition, etf);
    if (!("ok" in definition)) {
      if (etf.widgets.length >= MAX_WIDGETS_PER_ETF) return { ok: false, reason: "too_many" };
      return { ok: true, intent: { action: "widget_add", symbol, definition } };
    }
    return definition;
  }

  if (raw.action === "widget_update") {
    const hasSlot = raw.slot !== undefined;
    const hasMatch = raw.match !== undefined;
    if (hasSlot === hasMatch) return { ok: false, reason: "malformed" };
    if (!isRecord(raw.changes) || !hasOnlyKeys(raw.changes, CHANGE_KEYS) || Object.keys(raw.changes).length === 0) {
      return { ok: false, reason: "malformed" };
    }
    const changesInput = Object.fromEntries(Object.entries(raw.changes)) as Partial<WidgetDefinition>;

    if (hasMatch) {
      if (!hasOnlyKeys(raw, ["capability", "action", "etf", "match", "changes"])) return { ok: false, reason: "malformed" };
      const parsedMatch = parseWidgetMatch(raw.match);
      if (!parsedMatch.ok) return parsedMatch;
      const slots = matchingSlots(etf.widgets, parsedMatch.match);
      for (const slot of slots) {
        const existing = etf.widgets.find((widget) => widget.slot === slot)!;
        const merged = mergeWidgetChanges(existing, raw.changes);
        const changes = validateDefinition(merged, etf);
        if ("ok" in changes) return changes;
      }
      return { ok: true, intent: { action: "widget_update", symbol, slots, changes: changesInput } };
    }

    if (!hasOnlyKeys(raw, ["capability", "action", "etf", "slot", "changes"]) || !validSlot(raw.slot)) {
      return { ok: false, reason: "malformed" };
    }
    const existing = etf.widgets.find((widget) => widget.slot === raw.slot);
    if (existing === undefined) return { ok: false, reason: "bad_slot" };
    const merged = mergeWidgetChanges(existing, raw.changes);
    const changes = validateDefinition(merged, etf);
    if ("ok" in changes) return changes;
    return {
      ok: true,
      intent: { action: "widget_update", symbol, slot: raw.slot, changes: changesInput },
    };
  }

  if (raw.action === "widget_clear") {
    const hasSlot = raw.slot !== undefined;
    const hasMatch = raw.match !== undefined;
    if (hasSlot === hasMatch) return { ok: false, reason: "malformed" };

    if (hasMatch) {
      if (!hasOnlyKeys(raw, ["capability", "action", "etf", "match"])) return { ok: false, reason: "malformed" };
      const parsedMatch = parseWidgetMatch(raw.match);
      if (!parsedMatch.ok) return parsedMatch;
      const slots = matchingSlots(etf.widgets, parsedMatch.match);
      return { ok: true, intent: { action: "widget_clear", symbol, slots } };
    }

    if (!hasOnlyKeys(raw, ["capability", "action", "etf", "slot"]) ||
        (raw.slot !== "all" && !validSlot(raw.slot))) {
      return { ok: false, reason: "malformed" };
    }
    if (raw.slot !== "all" && !etf.widgets.some((widget) => widget.slot === raw.slot)) {
      return { ok: false, reason: "bad_slot" };
    }
    return { ok: true, intent: { action: "widget_clear", symbol, slot: raw.slot as number | "all" } };
  }

  if (raw.action === "widget_replace") {
    if (!hasOnlyKeys(raw, ["capability", "action", "etf", "definitions"]) ||
        !Array.isArray(raw.definitions)) return { ok: false, reason: "malformed" };
    if (raw.definitions.length > MAX_WIDGETS_PER_ETF) return { ok: false, reason: "too_many" };
    const definitions: WidgetDefinition[] = [];
    for (const definition of raw.definitions) {
      const validated = validateDefinition(definition, etf);
      if ("ok" in validated) return validated;
      definitions.push(validated);
    }
    return { ok: true, intent: { action: "widget_replace", symbol, definitions } };
  }

  return { ok: false, reason: "unknown_operation" };
}
