import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import ro from "../messages/ro.json";
import { ThemeToggle } from "./ThemeToggle";
import type { Locale } from "@/i18n/locale";

function render(locale: Locale, messages: typeof ro | typeof en) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ThemeToggle />
    </NextIntlClientProvider>,
  );
}

describe("US-035 AC4: ThemeToggle", () => {
  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("TT-1 renders the button with the locale's aria-label and text (%s)", (locale, messages) => {
    const html = render(locale, messages);
    expect(html).toContain("data-theme-toggle");
    expect(html).toContain(`aria-label="${messages.Theme.toggleLabel}"`);
    expect(html).toContain(messages.Theme.toggleText);
  });

  it("TT-1 ro and en renders don't contain the other locale's text", () => {
    const roHtml = render("ro", ro);
    const enHtml = render("en", en);
    expect(roHtml).not.toContain(en.Theme.toggleText);
    expect(enHtml).not.toContain(ro.Theme.toggleText);
  });

  it("TT-2 source scan: 'use client', imports toggleTheme, no theme-dependent state", () => {
    const source = readFileSync(new URL("./ThemeToggle.tsx", import.meta.url), "utf8");
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
    expect(source).toContain('import { toggleTheme } from "@/lib/theme"');
    expect(source).not.toContain("useState");
    expect(source).not.toContain("useEffect");
  });
});
