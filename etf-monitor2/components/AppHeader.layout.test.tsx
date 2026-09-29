import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import ro from "../messages/ro.json";
import { AppHeader } from "./AppHeader";
import type { Locale } from "@/i18n/locale";

vi.mock("@/i18n/actions", () => ({ setLocale: vi.fn() }));

let mockPathname: string | null = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

function renderHeader(locale: Locale, messages: typeof ro | typeof en) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AppHeader />
    </NextIntlClientProvider>,
  );
}

describe("US-035 AC3: header layout", () => {
  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("AH-L1 markup order: app name, then nav, then theme toggle, then language form (%s)", (locale, messages) => {
    mockPathname = "/";
    const html = renderHeader(locale, messages);
    const nameIdx = html.indexOf('href="/"');
    const navIdx = html.indexOf("data-app-nav");
    const toggleIdx = html.indexOf("data-theme-toggle");
    const formIdx = html.indexOf("<form");
    expect(nameIdx).toBeGreaterThanOrEqual(0);
    expect(nameIdx).toBeLessThan(navIdx);
    expect(navIdx).toBeLessThan(toggleIdx);
    expect(toggleIdx).toBeLessThan(formIdx);
  });

  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("AH-L2 the nav holds exactly four links, in order, with the locale's texts (%s)", (locale, messages) => {
    mockPathname = "/";
    const html = renderHeader(locale, messages);
    const hrefs = ["/", "/chat", "/admin", "/health"];
    const indices = hrefs.map((h) => html.indexOf(`href="${h}"`));
    expect(indices.every((i) => i >= 0)).toBe(true);
    for (let i = 1; i < indices.length; i++) expect(indices[i - 1]).toBeLessThan(indices[i]);
    expect(html).toContain(messages.Nav.home);
    expect(html).toContain(messages.Nav.chat);
    expect(html).toContain(messages.Nav.admin);
    expect(html).toContain(messages.Nav.health);
  });

  it("AH-L3 exactly one nav link carries aria-current=page, matching the pathname", () => {
    const cases: [string, string | null][] = [
      ["/", "Nav.home"],
      ["/chat", "Nav.chat"],
      ["/admin/etfs", "Nav.admin"],
      ["/health", "Nav.health"],
      ["/etf/BTBETRETF", null],
      [null as unknown as string, null],
    ];
    for (const [pathname, expectedKey] of cases) {
      mockPathname = pathname;
      const html = renderHeader("en", en);
      const currentCount = (html.match(/aria-current="page"/g) ?? []).length;
      if (expectedKey === null) {
        expect(currentCount).toBe(0);
      } else {
        expect(currentCount).toBe(1);
      }
    }
  });

  it("AH-L4 each nav link has an aria-label matching its text", () => {
    mockPathname = "/";
    const html = renderHeader("en", en);
    expect(html).toContain(`aria-label="${en.Nav.home}"`);
    expect(html).toContain(`aria-label="${en.Nav.chat}"`);
    expect(html).toContain(`aria-label="${en.Nav.admin}"`);
    expect(html).toContain(`aria-label="${en.Nav.health}"`);
  });

  it("AH-L5 ro and en renders never contain the other locale's nav/toggle texts", () => {
    mockPathname = "/";
    const roHtml = renderHeader("ro", ro);
    const enHtml = renderHeader("en", en);
    expect(roHtml).not.toContain(en.Theme.toggleText);
    expect(enHtml).not.toContain(ro.Theme.toggleText);
    expect(roHtml).not.toContain(en.Nav.admin);
    expect(enHtml).not.toContain(ro.Nav.admin);
  });
});
