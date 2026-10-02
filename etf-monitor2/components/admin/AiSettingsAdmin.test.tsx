import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import ro from "../../messages/ro.json";
import { PROVIDER_CATALOG } from "../../lib/ai/provider-catalog";
import { IDLE_STATE } from "./action-state";
import { AiSettingsAdmin, type AiSettingsAdminProps } from "./AiSettingsAdmin";
import { resetAfterSuccessfulAction } from "./ProviderKeySaveForm";

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
    settings: { status: "ok", provider: null, model: null },
    providers: PROVIDER_CATALOG.map(({ id, name }) => ({ id, name })),
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
  };
}

describe("AI settings key controls (ASK)", () => {
  it.each([
    ["en", en] as const,
    ["ro", ro] as const,
  ])("ASK-1 (%s): enabled storage shows an empty write-only input and localized source/status", (locale, messages) => {
    const html = render(locale, messages, props(true));
    expect(html).toContain('type="password"');
    expect(html).toContain('autoComplete="off"');
    expect(html).not.toMatch(/type="password"[^>]*(?:value|defaultValue)=/i);
    expect(html).toContain(messages.Admin.ai.sourceStored);
    expect(html).toContain(messages.Admin.ai.sourceNone);
    expect(html).toContain(messages.Admin.ai.clearStoredKey);
    expect(html.includes(FAKE_KEY)).toBe(false);
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

  it("ASK-3: the write-only save wrapper resets its uncontrolled form only on success", async () => {
    const reset = vi.fn();
    const action = vi.fn(async () => ({ status: "success" as const, messageKey: "providerKeySaved" as const }));
    const wrapped = resetAfterSuccessfulAction(action, reset);
    const data = new FormData();
    data.set("key", FAKE_KEY);

    const result = await wrapped(IDLE_STATE, data);

    expect(result).toEqual({ status: "success", messageKey: "providerKeySaved" });
    expect(reset).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("ASK-4: failed save does not clear the input, allowing correction", async () => {
    const reset = vi.fn();
    const action = vi.fn(async () => ({ status: "error" as const, messageKey: "providerKeyInvalid" as const }));
    const wrapped = resetAfterSuccessfulAction(action, reset);

    await wrapped(IDLE_STATE, new FormData());

    expect(reset).not.toHaveBeenCalled();
  });
});
