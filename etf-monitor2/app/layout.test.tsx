import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

vi.mock("next-intl/server", () => ({
  getLocale: async () => "en",
  getMessages: async () => ({}),
  getTranslations: async () => (key: string) => key,
}));
vi.mock("next-intl", () => ({
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/AppHeader", () => ({
  AppHeader: () => null,
}));

describe("RL: app/layout.tsx", () => {
  it("RL-1 html has suppressHydrationWarning and no data-theme prop", async () => {
    const { default: RootLayout } = await import("./layout");
    const element = await RootLayout({ children: null });
    expect(element.type).toBe("html");
    expect(element.props.suppressHydrationWarning).toBe(true);
    expect(element.props["data-theme"]).toBeUndefined();
  });

  it("RL-2 head holds a script with the theme init script, before body", async () => {
    const { default: RootLayout } = await import("./layout");
    const element = await RootLayout({ children: null });
    const markup = renderToStaticMarkup(element);
    const headIdx = markup.indexOf("<head");
    const bodyIdx = markup.indexOf("<body");
    expect(headIdx).toBeGreaterThanOrEqual(0);
    expect(headIdx).toBeLessThan(bodyIdx);
    // dangerouslySetInnerHTML content is inline in the rendered script tag
    expect(markup.slice(headIdx, bodyIdx)).toContain(THEME_INIT_SCRIPT.replace(/</g, "\\u003c"));
  });

  it("RL-3 no next/font import in app/layout.tsx", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("next/font");
    expect(source).not.toContain("Geist");
  });
});
