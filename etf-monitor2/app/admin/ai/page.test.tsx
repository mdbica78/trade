import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import ro from "../../../messages/ro.json";
import type { Locale } from "@/i18n/locale";
import type { AiSettings } from "@/lib/config/ai-settings";
import { PROVIDER_CATALOG } from "@/lib/ai/provider-catalog";

let mockGetAiSettings: () => Promise<AiSettings>;
let mockGetDb: () => unknown = () => ({});
let mockCreateAiSettingsDeps: () => unknown = () => ({});
type MockKeyRow = {
  id: string;
  name: string;
  requiresApiKey: boolean;
  apiKeyEnvVar: string;
  isSet: boolean;
  source: "stored" | "environment" | "none";
  updatedAt: string | null;
};
let mockKeyRows: MockKeyRow[] = [];
let mockStorageEnabled = true;

vi.mock("@/lib/db", () => ({ getDb: () => mockGetDb() }));
vi.mock("@/lib/ai/settings-deps", () => ({ createAiSettingsDeps: () => mockCreateAiSettingsDeps() }));
vi.mock("@/lib/ai/provider-deps", () => ({
  getProviderKeyStatusViews: async () => mockKeyRows,
  getProviderKeyStorageEnabled: () => mockStorageEnabled,
}));
vi.mock("@/lib/config/ai-settings", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/config/ai-settings")>();
  return { ...original, getAiSettings: () => mockGetAiSettings() };
});
vi.mock("./actions", () => ({
  saveAiSettingsAction: vi.fn(),
  saveProviderKeyAction: vi.fn(),
  clearProviderKeyAction: vi.fn(),
}));

beforeEach(() => {
  mockKeyRows = PROVIDER_CATALOG.map((provider) => ({
    id: provider.id,
    name: provider.name,
    requiresApiKey: provider.requiresApiKey,
    apiKeyEnvVar: provider.apiKeyEnvVar,
    isSet: false,
    source: "none",
    updatedAt: null,
  }));
  mockStorageEnabled = true;
});

afterEach(() => {
  vi.unstubAllEnvs();
  mockGetDb = () => ({});
  mockCreateAiSettingsDeps = () => ({});
  mockStorageEnabled = true;
});

async function renderPage(locale: Locale, messages: typeof ro | typeof en) {
  const { default: Page } = await import("./page");
  const element = await Page();
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {element}
    </NextIntlClientProvider>,
  );
}

describe("AI settings admin page (PA)", () => {
  it("PA-1: shows exactly one <select> option per catalogue provider + none, in catalogue order, the stored provider selected, model filled, static suggestions for that provider in a datalist (US-041 AC3)", async () => {
    const stored = PROVIDER_CATALOG[PROVIDER_CATALOG.length - 1];
    mockGetAiSettings = async () => ({ provider: stored.id, model: "llama-3.3-70b-versatile" });
    const html = await renderPage("en", en);
    const [beforeDatalist] = html.split("<datalist");
    const selectOptionCount = (beforeDatalist.match(/<option/g) ?? []).length;
    expect(selectOptionCount).toBe(PROVIDER_CATALOG.length + 1);
    const totalOptionCount = (html.match(/<option/g) ?? []).length;
    expect(totalOptionCount).toBe(PROVIDER_CATALOG.length + 1 + stored.modelSuggestions.length);
    expect(html).toMatch(new RegExp(`<option value="${stored.id}"[^>]*selected`));
    expect(html).toContain(en.Admin.ai.noneOption);
    expect(html).toContain('value="llama-3.3-70b-versatile"');
    for (const suggestion of stored.modelSuggestions) expect(html).toContain(`<option value="${suggestion}">`);
  });

  it("PA-1b: no stored provider/model selects none and leaves the model field empty", async () => {
    mockGetAiSettings = async () => ({ provider: null, model: null });
    const html = await renderPage("en", en);
    expect(html).toMatch(/<option value=""[^>]*selected/);
  });

  it("PA-7: a stored provider no longer in the catalogue selects none and shows the notice", async () => {
    mockGetAiSettings = async () => ({ provider: "openai", model: null });
    const html = await renderPage("en", en);
    expect(html).toMatch(/<option value=""[^>]*selected/);
    expect(html).toContain(en.Admin.ai.unknownStoredProvider.replace("{provider}", "openai"));
  });

  it("PA-7b: providers trimmed from the catalogue this story (mistral, openrouter) render safely in en and ro, none selected, notice shown", async () => {
    for (const staleId of ["mistral", "openrouter"]) {
      mockGetAiSettings = async () => ({ provider: staleId, model: null });
      const enHtml = await renderPage("en", en);
      expect(enHtml).toMatch(/<option value=""[^>]*selected/);
      expect(enHtml).toContain(en.Admin.ai.unknownStoredProvider.replace("{provider}", staleId));

      const roHtml = await renderPage("ro", ro);
      expect(roHtml).toMatch(/<option value=""[^>]*selected/);
      expect(roHtml).toContain(ro.Admin.ai.unknownStoredProvider.replace("{provider}", staleId));
    }
  });

  it("PA-2: en/ro renders never leak a stubbed key value", async () => {
    mockGetAiSettings = async () => ({ provider: null, model: null });
    mockKeyRows = PROVIDER_CATALOG.map((provider) => ({
      id: provider.id,
      name: provider.name,
      requiresApiKey: provider.requiresApiKey,
      apiKeyEnvVar: provider.apiKeyEnvVar,
      isSet: true,
      source: "environment",
      updatedAt: null,
    }));
    const enHtml = await renderPage("en", en);
    const roHtml = await renderPage("ro", ro);
    for (const html of [enHtml, roHtml]) {
      expect(html).not.toContain("SENTINEL");
      expect(html).not.toContain("9f3c");
      expect((html.match(/data-key-status="set"/g) ?? []).length).toBe(PROVIDER_CATALOG.length);
      for (const provider of PROVIDER_CATALOG) expect(html).toContain(provider.apiKeyEnvVar);
    }
    expect(enHtml).toContain(en.Admin.ai.keySet);
    expect(roHtml).toContain(ro.Admin.ai.keySet);
  });

  it("PA-3: unset/blank keys show not-set", async () => {
    mockGetAiSettings = async () => ({ provider: null, model: null });
    const html = await renderPage("en", en);
    expect((html.match(/data-key-status="not-set"/g) ?? []).length).toBe(PROVIDER_CATALOG.length);
    expect(html).toContain(en.Admin.ai.keyNotSet);
  });

  it("PA-4: enabled storage renders empty password fields with autocomplete off", async () => {
    mockGetAiSettings = async () => ({ provider: null, model: null });
    const html = await renderPage("en", en);
    expect(html).toContain('type="password"');
    expect(html).toContain('autoComplete="off"');
    expect(html).not.toMatch(/type="password"[^>]*value=/i);
    const names = [...html.matchAll(/<(?:input|select)[^>]*\bname="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(names)).toEqual(new Set(["provider", "model", "providerId", "key"]));
  });

  it("PA-5/PA-5b: ro/en show translated notes and identical provider names, never the other locale's text", async () => {
    mockGetAiSettings = async () => ({ provider: null, model: null });
    const enHtml = await renderPage("en", en);
    const roHtml = await renderPage("ro", ro);
    for (const provider of PROVIDER_CATALOG) {
      expect(enHtml).toContain(provider.name);
      expect(roHtml).toContain(provider.name);
    }
    expect(enHtml).toContain(en.Admin.ai.keysNote);
    expect(roHtml).toContain(ro.Admin.ai.keysNote);
    expect(roHtml).not.toContain(en.Admin.ai.heading);
    expect(enHtml).not.toContain(ro.Admin.ai.heading);
  });

  it("PA-10: ro and en link to /chat with the translated chat link, and the old note is gone from both catalogues", async () => {
    mockGetAiSettings = async () => ({ provider: null, model: null });
    const enHtml = await renderPage("en", en);
    const roHtml = await renderPage("ro", ro);
    expect(enHtml).toContain('href="/chat"');
    expect(enHtml).toContain(en.Admin.ai.chatLink);
    expect(roHtml).toContain('href="/chat"');
    expect(roHtml).toContain(ro.Admin.ai.chatLink);
    expect("chatUnavailableNote" in en.Admin.ai).toBe(false);
    expect("chatUnavailableNote" in ro.Admin.ai).toBe(false);
  });

  it("PA-6: getAiSettings throwing gives the translated load error, no secret text, key table still renders", async () => {
    mockGetAiSettings = async () => {
      throw new Error("connection refused: postgres://user:secret@db.example.com/etfs");
    };
    const html = await renderPage("en", en);
    expect(html).toContain(en.Admin.ai.loadError);
    expect(html).not.toContain("connection refused");
    expect(html).not.toContain("postgres://");
    expect(html).not.toContain("secret");
    expect(html).toContain(en.Admin.ai.keysHeading);
  });

  it("PA-6b: getDb() or createAiSettingsDeps() throwing synchronously gives the same safe load error", async () => {
    mockGetAiSettings = async () => ({ provider: null, model: null });
    const secretMessage = "connection refused: postgres://user:secret@db.example.com/etfs";

    mockGetDb = () => {
      throw new Error(secretMessage);
    };
    const htmlA = await renderPage("en", en);
    expect(htmlA).toContain(en.Admin.ai.loadError);
    expect(htmlA).not.toContain("connection refused");
    expect(htmlA).not.toContain("postgres://");
    expect(htmlA).not.toContain("secret");
    expect(htmlA).toContain(en.Admin.ai.keysHeading);

    mockGetDb = () => ({});
    mockCreateAiSettingsDeps = () => {
      throw new Error(secretMessage);
    };
    const htmlB = await renderPage("en", en);
    expect(htmlB).toContain(en.Admin.ai.loadError);
    expect(htmlB).not.toContain("connection refused");
    expect(htmlB).not.toContain("postgres://");
    expect(htmlB).not.toContain("secret");
    expect(htmlB).toContain(en.Admin.ai.keysHeading);
  });

  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("LE-P8 (%s): a sentinel-bearing error renders the same HTML as a generic one and logs exactly one safe admin/ai line (key table still renders)", async (locale, messages) => {
    const SENTINEL = "postgres://user:SENTINELPW@host/db";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockGetAiSettings = async () => {
      const err = Object.assign(new Error(`connection refused ${SENTINEL}`), { name: "NeonDbError", code: "ECONNREFUSED" });
      throw err;
    };
    const sentinelHtml = await renderPage(locale, messages);
    const lines = spy.mock.calls.filter((c) => typeof c[0] === "string" && c[0].startsWith("[load-error]"));

    mockGetAiSettings = async () => {
      throw new Error("x");
    };
    const genericHtml = await renderPage(locale, messages);
    spy.mockRestore();

    expect(sentinelHtml).toBe(genericHtml);
    expect(sentinelHtml).toContain(messages.Admin.ai.loadError);
    expect(sentinelHtml).toContain(messages.Admin.ai.keysHeading);
    expect(sentinelHtml).not.toContain("SENTINELPW");
    expect(lines).toHaveLength(1);
    expect(lines[0][0]).toMatch(/^\[load-error\] admin\/ai /);
  });

  it("PA-9: no network call while rendering", async () => {
    mockGetAiSettings = async () => ({ provider: null, model: null });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await renderPage("en", en);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("PA-11: the page shows key sources and offers clearing only for a stored key", async () => {
    mockGetAiSettings = async () => ({ provider: null, model: null });
    mockKeyRows = PROVIDER_CATALOG.map((provider, index) => ({
      id: provider.id,
      name: provider.name,
      requiresApiKey: provider.requiresApiKey,
      apiKeyEnvVar: provider.apiKeyEnvVar,
      isSet: true,
      source: index === 0 ? "stored" : "environment",
      updatedAt: index === 0 ? "2026-10-02T12:00:00.000Z" : null,
    }));
    const html = await renderPage("en", en);
    expect(html).toContain('data-key-source="stored"');
    expect(html).toContain('data-key-source="environment"');
    expect(html).toContain(en.Admin.ai.sourceStored);
    expect(html).toContain(en.Admin.ai.sourceEnvironment);
    expect((html.match(new RegExp(en.Admin.ai.clearStoredKey, "g")) ?? []).length).toBe(1);
  });

  it("PA-12: disabled storage omits password/save/clear controls and preserves environment status in both locales", async () => {
    mockGetAiSettings = async () => ({ provider: null, model: null });
    mockStorageEnabled = false;
    mockKeyRows = PROVIDER_CATALOG.map((provider) => ({
      id: provider.id,
      name: provider.name,
      requiresApiKey: provider.requiresApiKey,
      apiKeyEnvVar: provider.apiKeyEnvVar,
      isSet: true,
      source: "environment",
      updatedAt: null,
    }));
    const enHtml = await renderPage("en", en);
    const roHtml = await renderPage("ro", ro);
    expect(enHtml).toContain(en.Admin.ai.storageDisabled);
    expect(roHtml).toContain(ro.Admin.ai.storageDisabled);
    expect(enHtml).toContain(en.Admin.ai.sourceEnvironment);
    expect(enHtml).not.toContain('type="password"');
    expect(enHtml).not.toContain(en.Admin.ai.saveKey);
    expect(enHtml).not.toContain(en.Admin.ai.clearStoredKey);
  });

  it("PA-8: exports force-dynamic", async () => {
    const mod = await import("./page");
    expect(mod.dynamic).toBe("force-dynamic");
    expect(mod.runtime).toBe("nodejs");
  });
});
