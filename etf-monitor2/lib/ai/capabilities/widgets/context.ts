import { listWidgetsForEtf, type Widget, type WidgetConfigDeps } from "../../../config/widgets";
import type { ConfigurationContext, ContextWidget } from "../configuration/context";

export type WidgetContextEtf = {
  symbol: string;
  available: ConfigurationContext["etfs"][number]["available"];
  widgets: readonly Widget[];
};

export type WidgetContext = { etfs: readonly WidgetContextEtf[] };

/**
 * Loads preflight state through the existing config boundary. These widgets are also projected
 * (via `withWidgets`) into the prompt as data (DEC-025 §1) — never as free text, always as the
 * closed `ContextWidget` shape.
 */
export async function loadWidgetContext(
  configuration: ConfigurationContext,
  deps: WidgetConfigDeps,
): Promise<WidgetContext> {
  const results = await Promise.all(configuration.etfs.map((etf) => listWidgetsForEtf(etf.symbol, deps)));
  const etfs: WidgetContextEtf[] = [];
  for (let index = 0; index < configuration.etfs.length; index += 1) {
    const etf = configuration.etfs[index]!;
    const result = results[index]!;
    if (!result.ok) {
      if (result.error === "unknown_etf") continue;
      throw new Error("widget context unavailable");
    }
    etfs.push({ symbol: etf.symbol, available: etf.available, widgets: result.value });
  }
  return { etfs };
}

function toContextWidget(widget: Widget): ContextWidget {
  return {
    slot: widget.slot,
    operation: widget.operation,
    fieldKey: widget.fieldKey,
    periodUnit: widget.periodUnit,
    periodAmount: widget.periodAmount,
    ...(widget.title === undefined ? {} : { title: widget.title }),
  };
}

/** Projects each ETF's widgets onto the configuration context for the prompt; does not mutate its input. */
export function withWidgets(configuration: ConfigurationContext, widgets: WidgetContext): ConfigurationContext {
  return {
    etfs: configuration.etfs.map((etf) => {
      const state = widgets.etfs.find((w) => w.symbol === etf.symbol);
      const sorted = [...(state?.widgets ?? [])].sort((a, b) => a.slot - b.slot);
      return { ...etf, widgets: sorted.map(toContextWidget) };
    }),
  };
}
