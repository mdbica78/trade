import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import ro from "../../messages/ro.json";
import { PROVIDER_CATALOG } from "../../lib/ai/provider-catalog";
import { IDLE_STATE } from "./action-state";
import { AiSettingsAdmin, type AiSettingsAdminProps } from "./AiSettingsAdmin";
import { resetFormAfterSuccessfulAction } from "./ProviderKeySaveForm";

const FAKE_KEY = "test-key-0000-component-only";

function render(locale: "en" | "ro", messages: typeof en | typeof ro, props: AiSettingsAdminProps) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AiSettingsAdmin {...props} />
    </NextIntlClientProvider>,
  );
}

function props(storageEnabled: boolean): AiSettingsAdminProps {
  return {
    settings: { status: "ok", provider: PROVIDER_CATALOG[0].id, model: null },
    providers: PROVIDER_CATALOG.map(({ id, name, modelSuggestions }) => ({ id, name, modelSuggestions })),
    keyRows: PROVIDER_CATALOG.map((provider, index) => ({
      id: provider.id,
      name: provider.name,
      requiresApiKey: provider.requiresApiKey,
      apiKeyEnvVar: provider.apiKeyEnvVar,
      isSet: index === 0,
      source: index === 0 ? "stored" : "none",
      updatedAt: index === 0 ? "2026-10-02T12:00:00.000Z" : null,
    })),
    action: vi.fn(async () => IDLE_STATE),
    storageEnabled,
    saveProviderKeyAction: vi.fn(async () => IDLE_STATE),
    clearProviderKeyAction: vi.fn(async () => IDLE_STATE),
    testConnectionAction: vi.fn(async () => IDLE_STATE),
  };
}

describe("AI settings key controls (ASK)", () => {
  it.each([
    ["en", en] as const,
    ["ro", ro] as const,
  ])("ASK-1 (%s): enabled storage shows an empty write-only input and localized source/status for the selected provider only", (locale, messages) => {
    const html = render(locale, messages, props(true));
    expect(html).toContain('type="password"');
    expect(html).toContain('autoComplete="off"');
    expect((html.match(/type="password"/g) ?? []).length).toBe(1);
    expect(html).not.toMatch(/type="password"[^>]*(?:value|defaultValue)=/i);
    expect(html).toContain(messages.Admin.ai.sourceStored);
    expect(html).not.toContain('data-key-source="none"');
    expect(html).toContain(messages.Admin.ai.clearStoredKey);
    expect(html).toContain(messages.Admin.ai.replaceKey);
    expect(html.includes(FAKE_KEY)).toBe(false);
  });

  it("ASK-1b: a selected provider without a stored key offers Save (not Replace) and no Clear", () => {
    const p = props(true);
    p.settings = { status: "ok", provider: PROVIDER_CATALOG[1].id, model: null };
    const html = render("en", en, p);
    expect(html).toContain(en.Admin.ai.saveKey);
    expect(html).not.toContain(en.Admin.ai.replaceKey);
    expect(html).not.toContain(en.Admin.ai.clearStoredKey);
    expect(html).toContain('data-key-source="none"');
  });

  it("ASK-1c: a selected custom provider (no preset key row) shows the pointer, not a key form", () => {
    const p = props(true);
    p.providers = [...p.providers, { id: "custom-1", name: "Mine", modelSuggestions: [] }];
    p.settings = { status: "ok", provider: "custom-1", model: null };
    const html = render("en", en, p);
    expect(html).toContain(en.Admin.ai.keyCardCustom);
    expect(html).not.toContain('type="password"');
  });

  it("ASK-1d: when the saved settings fail to load, a provider can still be picked to manage its key", () => {
    const p = props(true);
    p.settings = { status: "error" };
    const html = render("en", en, p);
    expect(html).toContain(en.Admin.ai.loadError);
    expect(html).toContain(en.Admin.ai.keyCardNone);
    expect(html).not.toMatch(/<select[^>]*name=/);
  });

  it.each([
    ["en", en] as const,
    ["ro", ro] as const,
  ])("ASK-2 (%s): disabled storage omits all key controls but keeps environment status", (locale, messages) => {
    const disabled = props(false);
    disabled.keyRows = disabled.keyRows.map((row) => ({ ...row, isSet: true, source: "environment" }));
    const html = render(locale, messages, disabled);
    expect(html).toContain(messages.Admin.ai.storageDisabled);
    expect(html).toContain(messages.Admin.ai.sourceEnvironment);
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain(messages.Admin.ai.saveKey);
    expect(html).not.toContain(messages.Admin.ai.clearStoredKey);
  });

  it("ASK-3/ASK-4: successful save resets the uncontrolled form; an error leaves it intact", () => {
    const reset = vi.fn();
    const form = { reset };

    resetFormAfterSuccessfulAction({ status: "success", messageKey: "providerKeySaved" }, form);
    resetFormAfterSuccessfulAction({ status: "error", messageKey: "providerKeyInvalid" }, form);

    expect(reset).toHaveBeenCalledTimes(1);
  });
});
