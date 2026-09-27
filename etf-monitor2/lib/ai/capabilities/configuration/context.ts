import { listEtfs, type EtfConfigDeps } from "../../../config/etfs";
import { listFieldsForEtf } from "../../../config/tracked-fields";

export type ContextField = { fieldKey: string; labelRo: string; labelEn: string };

export type ContextEtf = {
  symbol: string;
  name: string;
  isActive: boolean;
  available: readonly ContextField[];
  tracked: readonly ContextField[];
};

export type ConfigurationContext = { etfs: readonly ContextEtf[] };

export type ConfigurationContextDeps = Pick<EtfConfigDeps, "db" | "run" | "registry">;

/** Reads only through `lib/config/` (DEC-016): no SQL of its own. */
export async function loadConfigurationContext(deps: ConfigurationContextDeps): Promise<ConfigurationContext> {
  const etfs = await listEtfs(deps);
  const views = await Promise.all(etfs.map((etf) => listFieldsForEtf(etf.symbol, deps)));

  const contextEtfs: ContextEtf[] = [];
  for (let i = 0; i < etfs.length; i += 1) {
    const etf = etfs[i]!;
    const view = views[i];
    if (view === null || view === undefined) continue; // deleted between the two reads
    contextEtfs.push({
      symbol: etf.symbol,
      name: etf.name,
      isActive: etf.isActive,
      available: view.available.map((f) => ({ fieldKey: f.fieldKey, labelRo: f.labelRo, labelEn: f.labelEn })),
      tracked: view.tracked.map((f) => ({ fieldKey: f.fieldKey, labelRo: f.labelRo, labelEn: f.labelEn })),
    });
  }

  return { etfs: contextEtfs };
}
