import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import ro from "../../messages/ro.json";
import { HeaderNav } from "../HeaderNav";
import { ThemeToggle } from "../ThemeToggle";
import { IDLE_STATE } from "./action-state";
import { TrackedFieldsAdmin } from "./TrackedFieldsAdmin";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/etfs/XYZ/fields" }));

function render(locale: "en" | "ro") {
  const messages = locale === "ro" ? ro : en;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <>
        <HeaderNav />
        <ThemeToggle />
        <TrackedFieldsAdmin
          status="ok"
          view={{
            etf: { symbol: "XYZ", name: "Example ETF", adapterKey: "example", adapterAvailable: true, isActive: true },
            tracked: [
              { fieldKey: "first_field", labelRo: "Primul", labelEn: "First", unit: null, position: 1, available: true },
              { fieldKey: "second_field", labelRo: "Al doilea", labelEn: "Second", unit: "EUR", position: 2, available: true },
            ],
            available: [
              { fieldKey: "first_field", labelRo: "Primul", labelEn: "First", unit: null, tracked: true, position: 1 },
              { fieldKey: "second_field", labelRo: "Al doilea", labelEn: "Second", unit: "EUR", tracked: true, position: 2 },
              { fieldKey: "third_field", labelRo: "Al treilea", labelEn: "Third", unit: "count", tracked: false, position: null },
            ],
          }}
          actions={{
            track: async () => IDLE_STATE,
            untrack: async () => IDLE_STATE,
            move: async () => IDLE_STATE,
          }}
        />
      </>
    </NextIntlClientProvider>,
  );
}

describe("US-052 D10-D11 admin/header markup", () => {
  it.each(["en", "ro"] as const)("matches the pre-refactor serialized markup (%s)", (locale) => {
    expect(render(locale)).toMatchSnapshot();
  });
});
