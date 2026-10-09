import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ro from "../../messages/ro.json";
import type { Locale } from "@/i18n/locale";
import AdminIndexPage from "./page";

function render(locale: Locale, messages: typeof ro | typeof en) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AdminIndexPage />
    </NextIntlClientProvider>,
  );
}

describe("Admin index page (AI)", () => {
  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("AI-1: renders the translated intro and the ETFs section link (%s)", (locale, messages) => {
    const html = render(locale, messages);
    expect(html).toContain(messages.Admin.index.intro);
    expect(html).toContain('href="/admin/etfs"');
  });
});
