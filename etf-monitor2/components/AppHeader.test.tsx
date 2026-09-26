import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import ro from "../messages/ro.json";
import { AppHeader } from "./AppHeader";
import type { Locale } from "@/i18n/locale";

vi.mock("@/i18n/actions", () => ({
  setLocale: vi.fn(),
}));

function renderHeader(locale: Locale, messages: typeof ro | typeof en) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AppHeader />
    </NextIntlClientProvider>,
  );
}

describe("AppHeader", () => {
  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("renders the app name and the home nav label for locale %s", (locale, messages) => {
    const html = renderHeader(locale, messages);
    expect(html).toContain(messages.App.name);
    expect(html).toContain(messages.Nav.home);
  });

  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("renders the Admin and Health nav links with their hrefs (N5, %s)", (locale, messages) => {
    const html = renderHeader(locale, messages);
    expect(html).toContain('href="/admin"');
    expect(html).toContain(messages.Nav.admin);
    expect(html).toContain('href="/health"');
    expect(html).toContain(messages.Nav.health);
  });

  it("ro and en renders never contain the other locale's differing text", () => {
    const roHtml = renderHeader("ro", ro);
    const enHtml = renderHeader("en", en);

    expect(roHtml).not.toContain(en.Nav.home);
    expect(enHtml).not.toContain(ro.Nav.home);
    if (ro.App.name !== en.App.name) {
      expect(roHtml).not.toContain(en.App.name);
      expect(enHtml).not.toContain(ro.App.name);
    }
  });
});
