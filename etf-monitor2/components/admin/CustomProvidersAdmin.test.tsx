import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import ro from "../../messages/ro.json";
import { IDLE_STATE } from "./action-state";
import { CustomProvidersAdmin, type CustomProvidersAdminProps } from "./CustomProvidersAdmin";

const FAKE_KEY = "test-key-0000-component-only";

function render(locale: "en" | "ro", messages: typeof en | typeof ro, props: CustomProvidersAdminProps) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <CustomProvidersAdmin {...props} />
    </NextIntlClientProvider>,
  );
}

function baseProps(overrides: Partial<CustomProvidersAdminProps> = {}): CustomProvidersAdminProps {
  return {
    customProviders: {
      status: "ok",
      providers: [
        { id: "custom-1", name: "Groq via custom", baseUrl: "https://api.groq.com/openai/v1", keySet: true, updatedAt: "2026-10-06T00:00:00.000Z" },
      ],
    },
    storageEnabled: true,
    addAction: vi.fn(async () => IDLE_STATE),
    updateAction: vi.fn(async () => IDLE_STATE),
    deleteAction: vi.fn(async () => IDLE_STATE),
    saveProviderKeyAction: vi.fn(async () => IDLE_STATE),
    clearProviderKeyAction: vi.fn(async () => IDLE_STATE),
    ...overrides,
  };
}

describe("CustomProvidersAdmin (CPU)", () => {
  it.each([
    ["en", en] as const,
    ["ro", ro] as const,
  ])("CPU-1 (%s): renders heading, provider name/url/key status, edit/delete/add forms with limits", (locale, messages) => {
    const html = render(locale, messages, baseProps());
    expect(html).toContain(messages.Admin.ai.customHeading);
    expect(html).toContain("Groq via custom");
    expect(html).toContain("https://api.groq.com/openai/v1");
    expect(html).toContain(messages.Admin.ai.customKeySet);
    expect(html).toContain(messages.Admin.ai.customUpdateSubmit);
    expect(html).toContain(messages.Admin.ai.customDeleteSubmit);
    expect(html).toContain(messages.Admin.ai.customAddSubmit);
    expect(html).toMatch(/maxLength="40"/);
    expect(html).toMatch(/maxLength="200"/);
    expect(html).toContain('type="url"');
    expect(html.includes(FAKE_KEY)).toBe(false);
  });

  it("CPU-2: storage disabled shows no password input and the disabled note", () => {
    const html = render("en", en, baseProps({ storageEnabled: false }));
    expect(html).not.toContain('type="password"');
    expect(html).toContain(en.Admin.ai.customStorageDisabled);
  });

  it("CPU-3: 5 providers shows no add form, only the limit note", () => {
    const providers = Array.from({ length: 5 }, (_, i) => ({
      id: `custom-${i + 1}`,
      name: `Provider ${i + 1}`,
      baseUrl: `https://api${i + 1}.example.com/v1`,
      keySet: false,
      updatedAt: null,
    }));
    const html = render("en", en, baseProps({ customProviders: { status: "ok", providers } }));
    expect(html).toContain(en.Admin.ai.customLimitNote);
    expect(html).not.toContain(en.Admin.ai.customAddSubmit);
  });

  it("CPU-4: an error state shows an alert and no forms", () => {
    const html = render("en", en, baseProps({ customProviders: { status: "error" } }));
    expect(html).toContain('role="alert"');
    expect(html).toContain(en.Admin.ai.customLoadError);
    expect(html).not.toContain("<form");
  });

  it("CPU-5: the url-change warning text is present on each edit form", () => {
    const html = render("en", en, baseProps());
    expect(html).toContain("Changing the address deletes this provider");
  });

  it("CPU-6: no value= on any password input and no key text anywhere", () => {
    const html = render("en", en, baseProps());
    expect(html).not.toMatch(/type="password"[^>]*(?:value|defaultValue)=/i);
    expect(html.includes(FAKE_KEY)).toBe(false);
  });
});
