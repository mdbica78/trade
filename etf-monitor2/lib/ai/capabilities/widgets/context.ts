import { listWidgetsForEtf, type Widget, type WidgetConfigDeps } from "../../../config/widgets";
import type { ConfigurationContext } from "../configuration/context";

export type WidgetContextEtf = {
  symbol: string;
  available: ConfigurationContext["etfs"][number]["available"];
  widgets: readonly Widget[];
};

export type WidgetContext = { etfs: readonly WidgetContextEtf[] };

/** Loads preflight state through the existing config boundary; this data is never sent to the model. */
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
