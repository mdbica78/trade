import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ro from "../../messages/ro.json";
import { PROVIDER_CATALOG } from "@/lib/ai/provider-catalog";
import { AiProviderModelFields, suggestionsForProvider } from "./AiProviderModelFields";

const PROVIDERS = PROVIDER_CATALOG.map(({ id, name, modelSuggestions }) => ({ id, name, modelSuggestions }));

function render(locale: "en" | "ro", messages: typeof en | typeof ro, props: Parameters<typeof AiProviderModelFields>[0]) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AiProviderModelFields {...props} />
    </NextIntlClientProvider>,
  );
}

describe("suggestionsForProvider (pure, PMF)", () => {
  it("PMF-1: returns the matching provider's static suggestions", () => {
    const gemini = PROVIDERS.find((p) => p.id === "gemini")!;
    expect(suggestionsForProvider(PROVIDERS, "gemini")).toEqual(gemini.modelSuggestions);
  });

  it("PMF-2: an unknown or empty provider id yields no suggestions", () => {
    expect(suggestionsForProvider(PROVIDERS, "")).toEqual([]);
    expect(suggestionsForProvider(PROVIDERS, "openai")).toEqual([]);
  });
});

describe("AiProviderModelFields rendering (PMF)", () => {
  it.each([
    ["en", en] as const,
    ["ro", ro] as const,
  ])("PMF-3 (%s): renders one option per catalogue provider + none, the selected provider's suggestions in a datalist, and the saved model value", (locale, messages) => {
    const html = render(locale, messages, { providers: PROVIDERS, selectedProvider: "groq", model: "llama-3.3-70b-versatile" });
    const optionCount = (html.match(/<option/g) ?? []).length;
    const groq = PROVIDERS.find((p) => p.id === "groq")!;
    // + 1 for the "none" option in the <select>.
    expect(optionCount).toBe(PROVIDERS.length + 1 + groq.modelSuggestions.length);
    expect(html).toMatch(new RegExp(`<option value="groq"[^>]*selected`));
    expect(html).toContain('value="llama-3.3-70b-versatile"');
    for (const suggestion of groq.modelSuggestions) expect(html).toContain(`<option value="${suggestion}">`);
  });

  it("PMF-4: no selected provider renders only the datalist's absence of suggestions, model empty", () => {
    const html = render("en", en, { providers: PROVIDERS, selectedProvider: "", model: "" });
    expect(html).toMatch(/<option value=""[^>]*selected/);
    expect(html).toMatch(/<datalist id="ai-model-suggestions"\s*\/>|<datalist id="ai-model-suggestions"><\/datalist>/);
  });

  it("PMF-5 (US-041 AC2): renders only provider/model form fields, never a base-URL or other endpoint input", () => {
    const html = render("en", en, { providers: PROVIDERS, selectedProvider: "gemini", model: "gemini-2.5-flash" });
    const names = [...html.matchAll(/<(?:input|select)[^>]*\bname="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(names)).toEqual(new Set(["provider", "model"]));
    expect(html.toLowerCase()).not.toContain("baseurl");
    expect(html.toLowerCase()).not.toContain("endpoint");
  });
});
