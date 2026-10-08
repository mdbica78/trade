import {
  addWidget,
  clearWidget,
  replaceWidgets,
  updateWidget,
  type WidgetConfigDeps,
} from "../../../config/widgets";
import type { WidgetIntent } from "./intent";

export type WidgetExecutionOutcome = {
  action: WidgetIntent["action"];
  symbol: string;
  changed: boolean;
  slot: number | null;
  matched?: number;
};

export type WidgetExecutionResult =
  | { ok: true; outcome: WidgetExecutionOutcome }
  | { ok: false };

function done(intent: WidgetIntent, changed: boolean, slot: number | null): WidgetExecutionResult {
  return { ok: true, outcome: { action: intent.action, symbol: intent.symbol, changed, slot } };
}

function doneMatched(intent: WidgetIntent, changed: boolean, slot: number | null, matched: number): WidgetExecutionResult {
  return { ok: true, outcome: { action: intent.action, symbol: intent.symbol, changed, slot, matched } };
}

/** Calls only the existing widget config boundary; never performs SQL in the AI capability. */
export async function executeWidgetIntent(
  intent: WidgetIntent,
  deps: WidgetConfigDeps,
): Promise<WidgetExecutionResult> {
  switch (intent.action) {
    case "widget_add": {
      const result = await addWidget({ symbol: intent.symbol, definition: intent.definition }, deps);
      return result.ok ? done(intent, true, result.value.slot) : { ok: false };
    }
    case "widget_update": {
      if ("slots" in intent) {
        if (intent.slots.length === 0) return doneMatched(intent, false, null, 0);
        for (const slot of intent.slots) {
          const result = await updateWidget({ symbol: intent.symbol, slot, changes: intent.changes }, deps);
          if (!result.ok) return { ok: false };
        }
        return doneMatched(intent, true, intent.slots.length === 1 ? intent.slots[0]! : null, intent.slots.length);
      }
      const result = await updateWidget({ symbol: intent.symbol, slot: intent.slot, changes: intent.changes }, deps);
      return result.ok ? done(intent, true, intent.slot) : { ok: false };
    }
    case "widget_clear": {
      if ("slots" in intent) {
        if (intent.slots.length === 0) return doneMatched(intent, false, null, 0);
        let changed = false;
        for (const slot of intent.slots) {
          const result = await clearWidget({ symbol: intent.symbol, slot }, deps);
          if (!result.ok) return { ok: false };
          if (result.value > 0) changed = true;
        }
        return doneMatched(intent, changed, intent.slots.length === 1 ? intent.slots[0]! : null, intent.slots.length);
      }
      const result = await clearWidget({ symbol: intent.symbol, slot: intent.slot }, deps);
      return result.ok ? done(intent, result.value > 0, intent.slot === "all" ? null : intent.slot) : { ok: false };
    }
    case "widget_replace": {
      const result = await replaceWidgets({ symbol: intent.symbol, definitions: intent.definitions }, deps);
      return result.ok ? done(intent, true, null) : { ok: false };
    }
  }
}
