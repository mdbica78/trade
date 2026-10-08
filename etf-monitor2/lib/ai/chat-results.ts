import type { ContextField } from "./capabilities/configuration/context";
import type { WidgetIntent } from "./capabilities/widgets/intent";
import type { ChatActionResult } from "./chat";

export type ActionDetail = {
  operation?: string;
  fieldKey?: string;
  field?: ContextField;
  periodUnit?: string;
  periodAmount?: number;
  slot?: number | "all";
  count?: number;
  to?: { operation?: string; fieldKey?: string; field?: ContextField; periodUnit?: string; periodAmount?: number };
};

/** Builds the per-action description shown next to a widget result (US-055 D-1). */
export function describeWidgetAction(intent: WidgetIntent, field?: ContextField): ActionDetail {
  if (intent.action === "widget_add") {
    return {
      operation: intent.definition.operation,
      fieldKey: intent.definition.fieldKey,
      field,
      periodUnit: intent.definition.periodUnit,
      periodAmount: intent.definition.periodAmount,
    };
  }
  if (intent.action === "widget_replace") {
    return { count: intent.definitions.length };
  }
  if (intent.action === "widget_update") {
    const slot = "slots" in intent ? ("all" as const) : intent.slot;
    return {
      slot: "slots" in intent && intent.slots.length === 1 ? intent.slots[0] : slot,
      to: {
        operation: intent.changes.operation,
        fieldKey: intent.changes.fieldKey,
        field,
        periodUnit: intent.changes.periodUnit,
        periodAmount: intent.changes.periodAmount,
      },
    };
  }
  // widget_clear
  const slot = "slots" in intent ? ("all" as const) : intent.slot;
  return { slot: "slots" in intent && intent.slots.length === 1 ? intent.slots[0] : slot };
}

export type ResultGroup = { first: ChatActionResult; symbols: string[] };

function groupKey(result: ChatActionResult): string {
  return JSON.stringify({
    index: result.index,
    status: result.status,
    capability: result.capability,
    action: result.action,
    nothingMatched: result.widget?.matched === 0,
    code: result.configuration?.code,
    adapterKey: result.configuration?.adapterKey,
    detectionReason: result.configuration?.detectionReason,
    fieldKey: result.field?.fieldKey,
    detail: JSON.stringify(result.detail),
  });
}

/** Groups same-shaped results (ignoring symbol and slot) into one line per group, first-appearance order. */
export function groupResults(results: readonly ChatActionResult[]): ResultGroup[] {
  const groups: ResultGroup[] = [];
  const index = new Map<string, ResultGroup>();
  for (const result of results) {
    const key = groupKey(result);
    const existing = index.get(key);
    if (existing === undefined) {
      const group: ResultGroup = { first: result, symbols: [result.symbol] };
      groups.push(group);
      index.set(key, group);
    } else {
      existing.symbols.push(result.symbol);
    }
  }
  return groups;
}
