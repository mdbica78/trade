import type { HomeDisplayPanelModel, HomeTableViewModel } from "@/lib/monitoring/home";

/**
 * A committed, static fixture for the QA render harness (US-036 AC11). Not read from a
 * database — every case AC11 asks for is represented once: at least 4 ETFs, several value
 * columns, a gain, a loss, a flat delta, a blank (untracked-but-no-value) cell, a row with no
 * PDF link, and a no-adapter row.
 */
export const RENDER_HOME_FIXTURE: HomeTableViewModel = {
  columns: [
    { fieldKey: "nav_per_unit", labelRo: "VUAN", labelEn: "NAV per unit", showAbsolute: true, showPercent: true, showArrow: true },
    { fieldKey: "units_in_circulation", labelRo: "Unități în circulație", labelEn: "Units in circulation" },
  ],
  rows: [
    {
      symbol: "BTBETRETF",
      name: "BT Butan ETF",
      adapterAvailable: true,
      latestPdfUrl: "https://bvb.ro/reports/btbetretf.pdf",
      valueDate: "2026-09-22",
      cells: {
        // Gain.
        nav_per_unit: {
          tracked: true,
          value: "11.171",
          delta: { absolute: "1.171", percent: "11.71", previousDate: "2026-09-20" },
        },
        // Flat.
        units_in_circulation: {
          tracked: true,
          value: "1000000",
          delta: { absolute: "0", percent: "0.00", previousDate: "2026-09-20" },
        },
      },
    },
    {
      symbol: "XYZ",
      name: "XYZ ETF",
      adapterAvailable: true,
      latestPdfUrl: "https://bvb.ro/reports/xyz.pdf",
      valueDate: "2026-09-22",
      cells: {
        // Loss.
        nav_per_unit: {
          tracked: true,
          value: "9.500",
          delta: { absolute: "-0.500", percent: "-5.00", previousDate: "2026-09-21" },
        },
        // Blank: tracked, but no value has ever been reported.
        units_in_circulation: { tracked: true, value: null, delta: null },
      },
    },
    {
      symbol: "ABCETF",
      name: "ABC ETF",
      adapterAvailable: true,
      // No PDF link discovered yet.
      latestPdfUrl: null,
      valueDate: "2026-09-22",
      cells: {
        // First-ever report: no previous value to compare against.
        nav_per_unit: { tracked: true, value: "5.000", delta: null },
        // Not tracked by this ETF at all.
        units_in_circulation: { tracked: false },
      },
    },
    {
      symbol: "NOADAPTER",
      name: "No Adapter ETF",
      adapterAvailable: false,
      latestPdfUrl: null,
      valueDate: null,
      cells: {
        nav_per_unit: { tracked: false },
        units_in_circulation: { tracked: false },
      },
    },
  ],
};

export const RENDER_HOME_CUSTOMIZATION: HomeDisplayPanelModel = {
  saved: true,
  showAbsolute: true,
  showPercent: true,
  showArrow: true,
  etfs: [
    { etfId: 1, symbol: "BTBETRETF", name: "BT Butan ETF", visible: true },
    { etfId: 2, symbol: "XYZ", name: "XYZ ETF", visible: true },
    { etfId: 3, symbol: "ABCETF", name: "ABC ETF", visible: true },
    { etfId: 4, symbol: "NOADAPTER", name: "No Adapter ETF", visible: true },
  ],
  columns: [
    {
      fieldKey: "nav_per_unit",
      labelRo: "VUAN",
      labelEn: "NAV per unit",
      visible: true,
      position: 0,
      catalogueOrder: 0,
      showAbsolute: true,
      showPercent: true,
      showArrow: true,
    },
    {
      fieldKey: "units_in_circulation",
      labelRo: "Unități în circulație",
      labelEn: "Units in circulation",
      visible: true,
      position: 1,
      catalogueOrder: 1,
      showAbsolute: null,
      showPercent: null,
      showArrow: null,
    },
  ],
};
