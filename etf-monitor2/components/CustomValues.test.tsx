import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import ro from "../messages/ro.json";
import type { WidgetView } from "@/lib/monitoring/history";
import { CustomValues } from "./CustomValues";

const base: WidgetView = {
  slot: 1,
  definition: { operation: "change", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7 },
  labelRo: "VUAN",
  labelEn: "NAV per unit",
  evaluation: { status: "ok", value: "2.50", basisDates: ["2026-10-05", "2026-09-28"] },
};

function render(locale: "en" | "ro", widgets: WidgetView[]) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "ro" ? ro : en} timeZone="UTC">
      <CustomValues widgets={widgets} />
    </NextIntlClientProvider>,
  );
}

describe("CustomValues", () => {
  it("renders no area without definitions", () => {
    expect(render("en", [])).toBe("");
  });

  it("renders the bilingual title, formatted signed change, accessible arrow and actual dates", () => {
    const english = render("en", [base]);
    expect(english).toContain("Custom values");
    expect(english).toContain("Change of NAV per unit over 7 days");
    expect(english).toContain("▲");
    expect(english).toContain("increased");
    expect(english).toContain("+2.50");
    expect(english).toContain("2026-10-05, 2026-09-28");
    const romanian = render("ro", [base]);
    expect(romanian).toContain("Valori personalizate");
    expect(romanian).toContain("Variație pentru VUAN pe 7 zile");
    expect(romanian).toContain("+2,50");
    expect(romanian).toContain("05.10.2026, 28.09.2026");
  });

  it("renders negative, flat and percentage states without a fabricated percent", () => {
    const negative = { ...base, evaluation: { status: "ok" as const, value: "-2.00", basisDates: ["2026-10-05", "2026-09-28"] } };
    const flat = { ...base, slot: 2, evaluation: { status: "ok" as const, value: "0.00", basisDates: ["2026-10-05", "2026-09-28"] } };
    const percent: WidgetView = {
      ...base, slot: 3, definition: { ...base.definition, operation: "percent_change" },
      evaluation: { status: "ok", value: null, basisDates: ["2026-10-05", "2026-09-28"] },
    };
    const html = render("en", [negative, flat, percent]);
    expect(html).toContain("▼");
    expect(html).toContain("decreased");
    expect(html).toContain("-2.00");
    expect(html).toContain("–");
    expect(html).toContain("unchanged");
    expect(html).toContain("Percent change");
    expect(html).not.toContain("NaN");
  });

  it("shows insufficient history and safely escapes a saved title; aggregates have no arrows", () => {
    const insufficient: WidgetView = {
      ...base, slot: 2,
      definition: { ...base.definition, operation: "average", title: "<script>alert(1)</script>" },
      evaluation: { status: "insufficient_history", basisDates: [] },
    };
    const average: WidgetView = {
      ...base, slot: 3, definition: { ...base.definition, operation: "average", periodUnit: "reports", periodAmount: 2 },
      evaluation: { status: "ok", value: "11.7500", basisDates: ["2026-10-05", "2026-10-03"] },
    };
    const html = render("ro", [insufficient, average]);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("Istoric insuficient");
    expect(html).toContain("11,7500");
    expect(html).toContain("2 rapoarte");
    expect(html).not.toContain("▲");
  });
});
