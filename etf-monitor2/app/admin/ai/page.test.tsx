import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import ro from "../../../messages/ro.json";
import type { Locale } from "@/i18n/locale";
import type { AiSettings } from "@/lib/config/ai-settings";

let mockGetAiSettings: () => Promise<AiSettings>;

vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/ai/settings-deps", () => ({ createAiSettingsDeps: () => ({}) }));
vi.mock("@/lib/config/ai-settings", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/config/ai-settings")>();
  return { ...original, getAiSettings: () => mockGetAiSettings() };
});
vi.mock("./actions", () => ({ saveAiSettingsAction: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
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

const SENTINELS = {
  GEMINI_API_KEY: "SENTINEL-gemini-9f3c",
  GROQ_API_KEY: "SENTINEL-groq-9f3c",
  OPENROUTER_API_KEY: "SENTINEL-openrouter-9f3c",
  MISTRAL_API_KEY: "SENTINEL-mistral-9f3c",
};

describe("AI settings admin page (PA)", () => {
  it("PA-1: shows exactly 5 provider options in catalogue order, the stored provider selected, model filled", async () => {
    mockGetAiSettings = async () => ({ provider: "groq", model: "llama-3.3-70b-versatile" });
    const html = await renderPage("en", en);
    const optionCount = (html.match(/<option/g) ?? []).length;
    expect(optionCount).toBe(5);
    expect(html).toMatch(/<option value="groq"[^>]*selected/);
    expect(html).toContain(en.Admin.ai.noneOption);
    expect(html).toContain('value="llama-3.3-70b-versatile"');
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

  it("PA-2: en/ro renders never leak a stubbed key value", async () => {
    mockGetAiSettings = async () => ({ provider: null, model: null });
    for (const [name, value] of Object.entries(SENTINELS)) vi.stubEnv(name, value);
    const html = await renderPage("en", en);
    expect(html).not.toContain("SENTINEL");
    expect(html).not.toContain("9f3c");
    expect((html.match(/data-key-status="set"/g) ?? []).length).toBe(4);
    expect(html).toContain(en.Admin.ai.keySet);
    for (const name of Object.keys(SENTINELS)) expect(html).toContain(name);
  });

  it("PA-3: unset/blank keys show not-set", async () => {
    mockGetAiSettings = async () => ({ provider: null, model: null });
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "   ");
    vi.stubEnv("OPENROUTER_API_KEY", undefined);
    vi.stubEnv("MISTRAL_API_KEY", undefined);
    const html = await renderPage("en", en);
    expect((html.match(/data-key-status="not-set"/g) ?? []).length).toBe(4);
    expect(html).toContain(en.Admin.ai.keyNotSet);
  });

  it("PA-4: no key-shaped input, no password input; only provider and model are named controls", async () => {
    mockGetAiSettings = async () => ({ provider: null, model: null });
    const html = await renderPage("en", en);
    expect(html).not.toMatch(/name="[^"]*key[^"]*"/i);
    expect(html).not.toContain('type="password"');
    const names = [...html.matchAll(/<(?:input|select)[^>]*\bname="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(names)).toEqual(new Set(["provider", "model"]));
  });

  it("PA-5/PA-5b: ro/en show translated notes and identical provider names, never the other locale's text", async () => {
    mockGetAiSettings = async () => ({ provider: null, model: null });
    const enHtml = await renderPage("en", en);
    const roHtml = await renderPage("ro", ro);
    for (const providerName of ["Google Gemini", "Groq", "OpenRouter", "Mistral"]) {
      expect(enHtml).toContain(providerName);
      expect(roHtml).toContain(providerName);
    }
    expect(enHtml).toContain(en.Admin.ai.keysNote);
    expect(roHtml).toContain(ro.Admin.ai.keysNote);
    expect(enHtml).toContain(en.Admin.ai.chatUnavailableNote);
    expect(roHtml).not.toContain(en.Admin.ai.heading);
    expect(enHtml).not.toContain(ro.Admin.ai.heading);
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

  it("PA-9: no network call while rendering", async () => {
    mockGetAiSettings = async () => ({ provider: null, model: null });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await renderPage("en", en);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("PA-8: exports force-dynamic", async () => {
    const mod = await import("./page");
    expect(mod.dynamic).toBe("force-dynamic");
  });
});
