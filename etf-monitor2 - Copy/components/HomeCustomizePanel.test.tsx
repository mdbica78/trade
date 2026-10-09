import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import ro from "../messages/ro.json";
import type { HomeDisplay } from "@/lib/config/home-display";
import type { HomeDisplayPanelModel } from "@/lib/monitoring/home";
import { HomeCustomizePanel } from "./HomeCustomizePanel";

const initial: HomeDisplayPanelModel = {
  saved: false,
  showAbsolute: true,
  showPercent: false,
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
  showPercent: false,
  showArrow: true,
  etfs: initial.etfs,
  columns: [{
    fieldKey: "net_asset",
    labelRo: "Activ net",
    labelEn: "Net assets",
    position: 0,
    showAbsolute: null,
    showPercent: null,
    showArrow: null,
  }],
  catalogue: initial.columns.map(({ fieldKey, labelRo, labelEn }) => ({ fieldKey, labelRo, labelEn })),
};

function render(locale: "ro" | "en", messages: typeof ro | typeof en) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <HomeCustomizePanel initial={initial} initialOpen saveAction={async () => ({ ok: true, display: savedDisplay })} />
    </NextIntlClientProvider>,
  );
}

describe("HomeCustomizePanel (US-047 AC1/AC7)", () => {
  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("HP-1: renders the title row and three ordered checkbox groups for %s", (locale, messages) => {
    const html = render(locale, messages);
    const titleIndex = html.indexOf(messages.HomeDisplay.title);
    const buttonIndex = html.indexOf(messages.HomeDisplay.customizeView);
    const panelIndex = html.indexOf('data-customize-panel=""');
    const groupLabels = [
      messages.HomeDisplay.etfsGroup,
      messages.HomeDisplay.valuesGroup,
      messages.HomeDisplay.changesGroup,
    ];
    expect(titleIndex).toBeGreaterThanOrEqual(0);
    expect(buttonIndex).toBeGreaterThan(titleIndex);
    expect(panelIndex).toBeGreaterThan(buttonIndex);
    expect(html.match(/<fieldset/g)).toHaveLength(3);
    expect(html.match(/type="checkbox"/g)).toHaveLength(7);
    const checkedStates = html.match(/<input type="checkbox"[^>]*>/g)?.map((input) => input.includes("checked")) ?? [];
    expect(checkedStates).toEqual([true, false, true, false, true, false, true]);
    expect(groupLabels.map((label) => html.indexOf(label))).toEqual(
      [...groupLabels].map((label) => html.indexOf(label)).sort((a, b) => a - b),
    );
    expect(html).toContain(messages.HomeDisplay.absolute);
    expect(html).toContain(messages.HomeDisplay.percent);
    expect(html).toContain(messages.HomeDisplay.arrow);
    expect(html).toContain(locale === "ro" ? "Activ net" : "Net assets");
    expect(html).toContain(locale === "ro" ? "VUAN" : "NAV per unit");
    expect(html).toContain('aria-expanded="true"');
    expect(html.match(/<button\b/g)).toHaveLength(1);
    expect(html).not.toContain("Save</button>");
    expect(html).not.toContain(locale === "ro" ? en.HomeDisplay.title : ro.HomeDisplay.title);
  });

  it("HP-2: the closed title row exposes an expandable button but no panel", () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
        <HomeCustomizePanel initial={initial} saveAction={async () => ({ ok: true, display: savedDisplay })} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('data-customize-panel=""');
  });
});
