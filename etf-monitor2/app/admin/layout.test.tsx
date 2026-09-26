import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ro from "../../messages/ro.json";
import type { Locale } from "@/i18n/locale";
import AdminLayout from "./layout";

function render(locale: Locale, messages: typeof ro | typeof en) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AdminLayout>
        <p>children</p>
      </AdminLayout>
    </NextIntlClientProvider>,
  );
}

describe("Admin layout (AL)", () => {
  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("AL-1: renders the translated title and the ETFs nav link (%s)", (locale, messages) => {
    const html = render(locale, messages);
    expect(html).toContain(messages.Admin.title);
    expect(html).toContain(messages.Admin.nav.etfs);
    expect(html).toContain('href="/admin/etfs"');
    expect(html).toContain("children");
  });

  it("AL-2: ro and en renders never contain the other locale's differing text", () => {
    const roHtml = render("ro", ro);
    const enHtml = render("en", en);
    expect(roHtml).not.toContain(en.Admin.title);
    expect(enHtml).not.toContain(ro.Admin.title);
  });
});
