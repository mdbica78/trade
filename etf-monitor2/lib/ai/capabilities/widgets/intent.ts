import { normaliseSymbol } from "../../../config/etfs";
import {
  MAX_WIDGETS_PER_ETF,
  validateWidgetDefinition,
  WIDGET_OPERATIONS,
  WIDGET_PERIOD_UNITS,
  type Widget,
  type WidgetDefinition,
  type WidgetError,
} from "../../../config/widgets";
import type { WidgetContext } from "./context";

export type WidgetIntent =
  | { action: "widget_add"; symbol: string; definition: WidgetDefinition }
  | { action: "widget_update"; symbol: string; slot: number; changes: Partial<WidgetDefinition> }
  | { action: "widget_clear"; symbol: string; slot: number | "all" }
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

const CONFIG_KEYS = ["capability", "action", "etf", "definition", "slot", "changes", "definitions"] as const;
const CHANGE_KEYS = ["operation", "fieldKey", "periodUnit", "periodAmount", "title"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function widgetError(error: WidgetError): WidgetIntentError {
  return error;
}

function etfState(symbol: string, context: WidgetContext) {
  return context.etfs.find((etf) => etf.symbol === symbol);
}

function validateDefinition(value: unknown, etf: NonNullable<ReturnType<typeof etfState>>): WidgetIntentResult | WidgetDefinition {
  const result = validateWidgetDefinition(value, etf.available.map((field) => ({ fieldKey: field.fieldKey, numeric: true })));
  return result.ok ? result.value : { ok: false, reason: widgetError(result.error) };
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
    if (Object.keys(raw).some((key) => !["capability", "action", "etf", "definition"].includes(key))) {
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
    if (Object.keys(raw).some((key) => !["capability", "action", "etf", "slot", "changes"].includes(key)) ||
        !Number.isInteger(raw.slot) || typeof raw.slot !== "number" || raw.slot < 1 ||
        raw.slot > MAX_WIDGETS_PER_ETF || !isRecord(raw.changes) ||
        !hasOnlyKeys(raw.changes, CHANGE_KEYS) || Object.keys(raw.changes).length === 0) {
      return { ok: false, reason: "malformed" };
    }
    const existing = etf.widgets.find((widget) => widget.slot === raw.slot);
    if (existing === undefined) return { ok: false, reason: "bad_slot" };
    const merged = {
      operation: existing.operation,
      fieldKey: existing.fieldKey,
      periodUnit: existing.periodUnit,
      periodAmount: existing.periodAmount,
      ...(existing.title === undefined ? {} : { title: existing.title }),
      ...raw.changes,
    };
    const changes = validateDefinition(merged, etf);
    if ("ok" in changes) return changes;
    return {
      ok: true,
      intent: {
        action: "widget_update",
        symbol,
        slot: raw.slot,
        changes: Object.fromEntries(Object.entries(raw.changes)) as Partial<WidgetDefinition>,
      },
    };
  }

  if (raw.action === "widget_clear") {
    if (Object.keys(raw).some((key) => !["capability", "action", "etf", "slot"].includes(key)) ||
        (raw.slot !== "all" && (typeof raw.slot !== "number" || !Number.isInteger(raw.slot) ||
          raw.slot < 1 || raw.slot > MAX_WIDGETS_PER_ETF))) {
      return { ok: false, reason: "malformed" };
    }
    if (raw.slot !== "all" && !etf.widgets.some((widget) => widget.slot === raw.slot)) {
      return { ok: false, reason: "bad_slot" };
    }
    return { ok: true, intent: { action: "widget_clear", symbol, slot: raw.slot as number | "all" } };
  }

  if (raw.action === "widget_replace") {
    if (Object.keys(raw).some((key) => !["capability", "action", "etf", "definitions"].includes(key)) ||
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

  return {
    ok: false,
    reason: (WIDGET_OPERATIONS as readonly string[]).includes(raw.action) ||
      (WIDGET_PERIOD_UNITS as readonly string[]).includes(raw.action) ? "malformed" : "unknown_operation",
  };
}

export function widgetForSlot(context: WidgetContext, symbol: string, slot: number): Widget | undefined {
  return etfState(symbol, context)?.widgets.find((widget) => widget.slot === slot);
}
