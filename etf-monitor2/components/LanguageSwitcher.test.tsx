import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import ro from "../messages/ro.json";
import { LanguageSwitcher } from "./LanguageSwitcher";
import type { Locale } from "@/i18n/locale";

vi.mock("@/i18n/actions", () => ({
  setLocale: vi.fn(),
}));

function renderSwitcher(locale: Locale, messages: typeof ro | typeof en) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LanguageSwitcher />
    </NextIntlClientProvider>,
  );
}

describe("LanguageSwitcher", () => {
  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("renders a form with RO and EN buttons for locale %s", (locale, messages) => {
    const html = renderSwitcher(locale, messages);
    expect(html).toContain("<form");
    expect(html).toContain(`aria-label="${messages.LanguageSwitcher.label}"`);
    expect(html).toContain(`>${messages.LanguageSwitcher.ro}<`);
    expect(html).toContain(`>${messages.LanguageSwitcher.en}<`);
  });

  it("marks the current locale's button as disabled and aria-current, the other neither", () => {
    const html = renderSwitcher("ro", ro);
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    const roButtonHtml = buttons.find((button) => button.includes('value="ro"'));
    const enButtonHtml = buttons.find((button) => button.includes('value="en"'));

    expect(roButtonHtml).toContain("disabled=");
    expect(roButtonHtml).toMatch(/aria-current="true"/);
    expect(enButtonHtml).not.toContain("disabled=");
    expect(enButtonHtml).not.toMatch(/aria-current/);
  });
});
