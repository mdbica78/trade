import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import ro from "../messages/ro.json";
import Home from "./page";
import type { Locale } from "@/i18n/locale";

function renderHome(locale: Locale, messages: typeof ro | typeof en) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <Home />
    </NextIntlClientProvider>,
  );
}

describe("Home page", () => {
  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("renders the app name and intro text for locale %s", (locale, messages) => {
    const html = renderHome(locale, messages);
    expect(html).toContain(messages.App.name);
    expect(html).toContain(messages.Home.intro);
  });

  it("ro and en renders never contain the other locale's differing text", () => {
    const roHtml = renderHome("ro", ro);
    const enHtml = renderHome("en", en);

    expect(roHtml).not.toContain(en.Home.intro);
    expect(enHtml).not.toContain(ro.Home.intro);
  });
});
