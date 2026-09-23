export const seedEtfs = [
  {
    symbol: "BTBETRETF",
    name: "Fondul Deschis de Investiții BT Index România ETF BET-TR",
    bvbUrl:
      "https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=BTBETRETF",
    adapterKey: "brd-depositary",
  },
  {
    symbol: "TVBETETF",
    name: "Fondul Deschis de Investiții ETF BET Patria-Tradeville",
    bvbUrl:
      "https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=TVBETETF",
    adapterKey: "brd-depositary",
  },
  {
    symbol: "PTENGETF",
    name: "Fondul Deschis de Investiții ETF Energie Patria-Tradeville",
    bvbUrl:
      "https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=PTENGETF",
    adapterKey: "brd-depositary",
  },
] as const;

export const seedFieldCatalog = [
  {
    adapterKey: "brd-depositary",
    fieldKey: "net_asset",
    labelRo: "Activ net",
    labelEn: "Net asset",
    unit: "RON",
  },
  {
    adapterKey: "brd-depositary",
    fieldKey: "units_in_circulation",
    labelRo: "Unități de fond în circulație",
    labelEn: "Units in circulation",
    unit: "count",
  },
  {
    adapterKey: "brd-depositary",
    fieldKey: "units_held_individuals",
    labelRo: "Unități deținute de persoane fizice",
    labelEn: "Units held by individuals",
    unit: "count",
  },
  {
    adapterKey: "brd-depositary",
    fieldKey: "units_held_legal_entities",
    labelRo: "Unități deținute de persoane juridice",
    labelEn: "Units held by legal entities",
    unit: "count",
  },
  {
    adapterKey: "brd-depositary",
    fieldKey: "nav_per_unit",
    labelRo: "Valoare unitară a activului net (VUAN)",
    labelEn: "Net asset value per unit",
    unit: "RON",
  },
  {
    adapterKey: "brd-depositary",
    fieldKey: "investors_total",
    labelRo: "Număr investitori",
    labelEn: "Number of investors",
    unit: "count",
  },
  {
    adapterKey: "brd-depositary",
    fieldKey: "investors_individuals",
    labelRo: "Investitori persoane fizice",
    labelEn: "Individual investors",
    unit: "count",
  },
  {
    adapterKey: "brd-depositary",
    fieldKey: "investors_legal_entities",
    labelRo: "Investitori persoane juridice",
    labelEn: "Legal-entity investors",
    unit: "count",
  },
] as const;

/** Same tracked-field set for every seeded ETF (all three share the BRD depositary adapter). */
export const seedTrackedFields = [
  { fieldKey: "units_in_circulation", displayOrder: 0 },
  { fieldKey: "nav_per_unit", displayOrder: 1 },
] as const;

export const seedSettings = {
  id: 1,
  defaultLocale: "ro",
} as const;
