import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import { AiSettingsForms } from "./AiSettingsForms";

const PROVIDERS = [
  { id: "groq", name: "Groq", modelSuggestions: [] },
  { id: "gemini", name: "Gemini", modelSuggestions: [] },
  { id: "custom-1", name: "Mine", modelSuggestions: [] },
];

function render(props: { selectedProvider: string; model: string; models: Record<string, string> }) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      <AiSettingsForms
        providers={PROVIDERS}
        action={vi.fn()}
        testConnectionAction={vi.fn()}
        keyRows={[]}
        storageEnabled
        saveProviderKeyAction={vi.fn()}
        clearProviderKeyAction={vi.fn()}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

describe("AiSettingsForms (DEC-029)", () => {
  it("ASF-1: the saved provider is the selected option and its own model is shown after a reload", () => {
    const html = render({ selectedProvider: "gemini", model: "gem-1", models: { groq: "g-1", gemini: "gem-1" } });
    expect(html).toMatch(/<option value="gemini"[^>]*selected/);
    expect(html).not.toMatch(/<option value="groq"[^>]*selected/);
    expect(html).toContain('value="gem-1"');
  });

  it("ASF-2: the Test connection form carries the live provider and model as hidden inputs, and no key or URL field", () => {
    const html = render({ selectedProvider: "custom-1", model: "my-model", models: { "custom-1": "my-model" } });
    const forms = html.split("<form").slice(1);
    expect(forms).toHaveLength(2);
    expect(forms[1]).toContain('type="hidden" name="provider" value="custom-1"');
    expect(forms[1]).toContain('type="hidden" name="model" value="my-model"');
    expect(html.toLowerCase()).not.toMatch(/baseurl|apikey|password/);
  });
});
