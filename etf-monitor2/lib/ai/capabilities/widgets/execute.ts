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
};

export type WidgetExecutionResult =
  | { ok: true; outcome: WidgetExecutionOutcome }
  | { ok: false };

function done(intent: WidgetIntent, changed: boolean, slot: number | null): WidgetExecutionResult {
  return { ok: true, outcome: { action: intent.action, symbol: intent.symbol, changed, slot } };
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
      const result = await updateWidget({ symbol: intent.symbol, slot: intent.slot, changes: intent.changes }, deps);
      return result.ok ? done(intent, true, intent.slot) : { ok: false };
    }
    case "widget_clear": {
      const result = await clearWidget({ symbol: intent.symbol, slot: intent.slot }, deps);
      return result.ok ? done(intent, result.value > 0, intent.slot === "all" ? null : intent.slot) : { ok: false };
    }
    case "widget_replace": {
      const result = await replaceWidgets({ symbol: intent.symbol, definitions: intent.definitions }, deps);
      return result.ok ? done(intent, true, null) : { ok: false };
    }
  }
}
