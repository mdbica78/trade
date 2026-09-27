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
  // intercapital-nav (US-029): the Class B (BVB-listed) NAV per unit and units in circulation
  // are the same measure, same unit as brd-depositary's — reused with identical labels
  // (DEC-018 §3, US-029 plan D1 default). Everything else is a distinct measure.
  {
    adapterKey: "intercapital-nav",
    fieldKey: "nav_per_unit",
    labelRo: "Valoare unitară a activului net (VUAN)",
    labelEn: "Net asset value per unit",
    unit: "RON",
  },
  {
    adapterKey: "intercapital-nav",
    fieldKey: "units_in_circulation",
    labelRo: "Unități de fond în circulație",
    labelEn: "Units in circulation",
    unit: "count",
  },
  {
    adapterKey: "intercapital-nav",
    fieldKey: "total_nav_class_b",
    labelRo: "Activ net total, clasa B (EUR)",
    labelEn: "Total net asset value, class B (EUR)",
    unit: "EUR",
  },
  {
    adapterKey: "intercapital-nav",
    fieldKey: "nav_per_unit_class_a",
    labelRo: "Valoare unitară a activului net (VUAN), clasa A (EUR)",
    labelEn: "Net asset value per unit, class A (EUR)",
    unit: "EUR",
  },
  {
    adapterKey: "intercapital-nav",
    fieldKey: "units_class_a",
    labelRo: "Unități de fond, clasa A",
    labelEn: "Units, class A",
    unit: "count",
  },
  {
    adapterKey: "intercapital-nav",
    fieldKey: "total_nav_class_a",
    labelRo: "Activ net total, clasa A (EUR)",
    labelEn: "Total net asset value, class A (EUR)",
    unit: "EUR",
  },
  {
    adapterKey: "intercapital-nav",
    fieldKey: "units_total",
    labelRo: "Unități de fond, toate clasele",
    labelEn: "Units, all classes",
    unit: "count",
  },
  {
    adapterKey: "intercapital-nav",
    fieldKey: "total_nav",
    labelRo: "Activ net total, toate clasele (EUR)",
    labelEn: "Total net asset value, all classes (EUR)",
    unit: "EUR",
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
