import { bindGenerate } from "../../lib/ai/capabilities/generate";
import type { CapabilityGenerate } from "../../lib/ai/capabilities/types";
import type { ConfigurationContext } from "../../lib/ai/capabilities/configuration/context";
import { createFakeProvider, fakeCallInput, type FakeStep } from "./ai-fakes";

const SEED_LABELS: Record<string, { labelRo: string; labelEn: string }> = {
  net_asset: { labelRo: "Activ net", labelEn: "Net asset" },
  units_in_circulation: { labelRo: "Unități de fond în circulație", labelEn: "Units in circulation" },
  units_held_individuals: { labelRo: "Unități deținute de persoane fizice", labelEn: "Units held by individuals" },
  units_held_legal_entities: { labelRo: "Unități deținute de persoane juridice", labelEn: "Units held by legal entities" },
  nav_per_unit: { labelRo: "Valoare unitară a activului net (VUAN)", labelEn: "Net asset value per unit" },
  investors_total: { labelRo: "Număr investitori", labelEn: "Number of investors" },
  investors_individuals: { labelRo: "Investitori persoane fizice", labelEn: "Individual investors" },
  investors_legal_entities: { labelRo: "Investitori persoane juridice", labelEn: "Legal-entity investors" },
};

const ALL_FIELD_KEYS = Object.keys(SEED_LABELS);

function field(fieldKey: string) {
  const label = SEED_LABELS[fieldKey]!;
  return { fieldKey, labelRo: label.labelRo, labelEn: label.labelEn };
}

/** A hand-built `ConfigurationContext` with the seed labels. BTBETRETF tracks only `units_in_circulation`. */
export function buildTestContext(overrides: Partial<ConfigurationContext> = {}): ConfigurationContext {
  return {
    etfs: [
      {
        symbol: "BTBETRETF",
        name: "Fondul Deschis de Investiții BT Index România ETF BET-TR",
        isActive: true,
        available: ALL_FIELD_KEYS.map(field),
        tracked: [field("units_in_circulation")],
      },
      {
        symbol: "TVBETETF",
        name: "Fondul Deschis de Investiții ETF BET Patria-Tradeville",
        isActive: true,
        available: ALL_FIELD_KEYS.map(field),
        tracked: [field("units_in_circulation"), field("nav_per_unit")],
      },
      {
        symbol: "NOADPETF",
        name: "No Adapter ETF",
        isActive: true,
        available: [],
        tracked: [],
      },
    ],
    ...overrides,
  };
}

export function cannedGenerate(text: string): CapabilityGenerate {
  const provider = createFakeProvider("fake", [{ ok: true, text }]);
  return bindGenerate(provider, fakeCallInput());
}

export function recordingGenerate(result: FakeStep): { generate: CapabilityGenerate; calls: unknown[] } {
  const provider = createFakeProvider("fake", [result]);
  return { generate: bindGenerate(provider, fakeCallInput()), calls: provider.calls };
}

export function stubNoNetwork() {
  return fakeCallInput();
}
