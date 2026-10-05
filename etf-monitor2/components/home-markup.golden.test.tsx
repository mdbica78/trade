import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import ro from "../messages/ro.json";
import { HomeTable, type HomeTableProps } from "./HomeTable";
import { HomeCustomizePanel } from "./HomeCustomizePanel";
import { HomePageBody } from "./HomePageBody";
import { CustomValues } from "./CustomValues";
import type { Locale } from "@/i18n/locale";
import type { HomeTableViewModel, HomeColumn, HomeDisplayPanelModel } from "@/lib/monitoring/home";
import type { HomeDisplay } from "@/lib/config/home-display";
import type { WidgetView } from "@/lib/monitoring/history";

/**
 * US-050 AC2: proves the home table / Customize panel / custom-values markup is byte-identical
 * across the B1/B6/B7/B8/B9 refactor. Written and run against the unchanged code first, so the
 * committed `.snap` predates every source edit (plan §1 step 1) — nothing to compare against
 * otherwise, since no exact-markup test existed for the change line or widget arrow before this.
 */

function renderWith(locale: Locale, messages: typeof ro | typeof en, node: React.ReactElement) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      {node}
    </NextIntlClientProvider>,
  );
}

const COLUMNS: HomeColumn[] = [
  { fieldKey: "nav_per_unit", labelRo: "VUAN", labelEn: "NAV per unit" },
];

const BASE_VIEW: HomeTableViewModel = {
  columns: COLUMNS,
  rows: [
    {
      symbol: "GAIN",
      name: "Gain ETF",
      adapterAvailable: true,
      latestPdfUrl: "https://bvb.ro/gain.pdf",
      valueDate: "2026-09-22",
      cells: {
        nav_per_unit: {
          tracked: true,
          value: "11.171",
          delta: { absolute: "0.050", percent: "0.45", previousDate: "2026-09-21" },
        },
      },
    },
    {
      symbol: "LOSS",
      name: "Loss ETF",
      adapterAvailable: true,
      latestPdfUrl: null,
      valueDate: "2026-09-22",
      cells: {
        nav_per_unit: {
          tracked: true,
          value: "9.900",
          delta: { absolute: "-0.100", percent: "-1.00", previousDate: "2026-09-21" },
        },
      },
    },
    {
      symbol: "FLAT",
      name: "Flat ETF",
      adapterAvailable: true,
      latestPdfUrl: null,
      valueDate: "2026-09-22",
      cells: {
        nav_per_unit: {
          tracked: true,
          value: "10.000",
          delta: { absolute: "0", percent: "0.00", previousDate: "2026-09-21" },
        },
      },
    },
    {
      symbol: "ZERODIV",
      name: "Zero Divisor ETF",
      adapterAvailable: true,
      latestPdfUrl: null,
      valueDate: "2026-09-22",
      cells: {
        nav_per_unit: {
          tracked: true,
          value: "5.000",
          delta: { absolute: "5.000", percent: null, previousDate: "2026-09-21" },
        },
      },
    },
    {
      symbol: "NODELTA",
      name: "No Delta ETF",
      adapterAvailable: true,
      latestPdfUrl: null,
      valueDate: "2026-09-22",
      cells: { nav_per_unit: { tracked: true, value: "8.000", delta: null } },
    },
    {
      symbol: "NOTTRACKED",
      name: "Not Tracked ETF",
      adapterAvailable: false,
      latestPdfUrl: null,
      valueDate: null,
      cells: { nav_per_unit: { tracked: false } },
    },
    {
      symbol: "NULLVALUE",
      name: "Null Value ETF",
      adapterAvailable: true,
      latestPdfUrl: null,
      valueDate: null,
      cells: { nav_per_unit: { tracked: true, value: null, delta: null } },
    },
  ],
};

function withFlags(flags: Partial<Pick<HomeColumn, "showArrow" | "showAbsolute" | "showPercent">>): HomeTableViewModel {
  return { ...BASE_VIEW, columns: COLUMNS.map((c) => ({ ...c, ...flags })) };
}

describe("US-050 AC2: home-table / panel / custom-values golden markup", () => {
  it.each([["ro", ro] as const, ["en", en] as const])("G-1 (%s): HomeTable, every delta/tracking/value state", (locale, messages) => {
    const html = renderWith(locale, messages, <HomeTable status="ok" viewModel={BASE_VIEW} />);
    expect(html).toMatchSnapshot();
  });

  it.each([
    ["default", {}],
    ["arrow-only", { showAbsolute: false, showPercent: false }],
    ["absolute-only", { showArrow: false, showPercent: false }],
    ["percent-only", { showArrow: false, showAbsolute: false }],
    ["all-false", { showArrow: false, showAbsolute: false, showPercent: false }],
  ] as const)("G-2 (%s): HomeTable under column flag combinations", (_name, flags) => {
    const html = renderWith("en", en, <HomeTable status="ok" viewModel={withFlags(flags)} />);
    expect(html).toMatchSnapshot();
  });

  it("G-3: HomeTable error and empty states", () => {
    const errorProps: HomeTableProps = { status: "error" };
    expect(renderWith("en", en, <HomeTable {...errorProps} />)).toMatchSnapshot();
    expect(renderWith("en", en, <HomeTable status="ok" viewModel={{ columns: COLUMNS, rows: [] }} />)).toMatchSnapshot();
  });

  const panelModel: HomeDisplayPanelModel = {
    saved: false,
    showAbsolute: true,
    showPercent: true,
    showArrow: true,
    etfs: [
      { etfId: 1, symbol: "AAA", name: "Alpha", visible: true },
      { etfId: 2, symbol: "BBB", name: "Beta", visible: false },
    ],
    columns: [
      {
        fieldKey: "net_asset", labelRo: "Activ net", labelEn: "Net assets",
        visible: true, position: 0, catalogueOrder: 0,
        showAbsolute: null, showPercent: null, showArrow: null,
      },
      {
        fieldKey: "nav_per_unit", labelRo: "VUAN", labelEn: "NAV per unit",
        visible: false, position: null, catalogueOrder: 1,
        showAbsolute: null, showPercent: null, showArrow: null,
      },
    ],
  };

  const savedDisplay: HomeDisplay = {
    saved: true,
    showAbsolute: true,
    showPercent: true,
    showArrow: true,
    etfs: panelModel.etfs,
    columns: [{
      fieldKey: "net_asset", labelRo: "Activ net", labelEn: "Net assets",
      position: 0, showAbsolute: null, showPercent: null, showArrow: null,
    }],
    catalogue: panelModel.columns.map(({ fieldKey, labelRo, labelEn }) => ({ fieldKey, labelRo, labelEn })),
  };

  it("G-4 (unsaved): HomeCustomizePanel open, no saved display", () => {
    const html = renderWith(
      "en", en,
      <HomeCustomizePanel initial={panelModel} initialOpen saveAction={async () => ({ ok: true, display: savedDisplay })} />,
    );
    expect(html).toMatchSnapshot();
  });

  it("G-4 (saved): HomeCustomizePanel open, saved display", () => {
    const savedModel: HomeDisplayPanelModel = { ...panelModel, saved: true };
    const html = renderWith(
      "en", en,
      <HomeCustomizePanel initial={savedModel} initialOpen saveAction={async () => ({ ok: true, display: savedDisplay })} />,
    );
    expect(html).toMatchSnapshot();
  });

  it.each([["ok" as const], ["error" as const]])("G-5 (%s): HomePageBody wraps the panel and table", (status) => {
    const tableProps: HomeTableProps = status === "ok" ? { status: "ok", viewModel: BASE_VIEW } : { status: "error" };
    const html = renderWith(
      "en", en,
      <HomePageBody
        tableProps={tableProps}
        customization={panelModel}
        saveAction={async () => ({ ok: true, display: savedDisplay })}
      />,
    );
    expect(html).toMatchSnapshot();
  });

  const changeGain: WidgetView = {
    slot: 1,
    definition: { operation: "change", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7 },
    labelRo: "VUAN", labelEn: "NAV per unit",
    evaluation: { status: "ok", value: "2.50", basisDates: ["2026-10-05", "2026-09-28"] },
  };
  const changeLoss: WidgetView = { ...changeGain, slot: 2, evaluation: { status: "ok", value: "-1.00", basisDates: ["2026-10-05", "2026-09-28"] } };
  const changeFlat: WidgetView = { ...changeGain, slot: 3, evaluation: { status: "ok", value: "0.00", basisDates: ["2026-10-05", "2026-09-28"] } };
  const percentWithValue: WidgetView = {
    ...changeGain, slot: 4, definition: { ...changeGain.definition, operation: "percent_change" },
    evaluation: { status: "ok", value: "3.20", basisDates: ["2026-10-05", "2026-09-28"] },
  };
  const percentNull: WidgetView = {
    ...changeGain, slot: 5, definition: { ...changeGain.definition, operation: "percent_change" },
    evaluation: { status: "ok", value: null, basisDates: ["2026-10-05", "2026-09-28"] },
  };
  const average: WidgetView = {
    ...changeGain, slot: 6, definition: { ...changeGain.definition, operation: "average", periodUnit: "reports", periodAmount: 2 },
    evaluation: { status: "ok", value: "11.7500", basisDates: ["2026-10-05", "2026-10-03"] },
  };
  const insufficient: WidgetView = {
    ...changeGain, slot: 7, definition: { ...changeGain.definition, operation: "average", title: "Custom title" },
    evaluation: { status: "insufficient_history", basisDates: [] },
  };

  it.each([["ro", ro] as const, ["en", en] as const])("G-6 (%s): CustomValues, every operation/value state", (locale, messages) => {
    const html = renderWith(
      locale, messages,
      <CustomValues widgets={[changeGain, changeLoss, changeFlat, percentWithValue, percentNull, average, insufficient]} />,
    );
    expect(html).toMatchSnapshot();
  });
});
