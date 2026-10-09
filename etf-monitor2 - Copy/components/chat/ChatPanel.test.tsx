import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ro from "@/messages/ro.json";
import type { Locale } from "@/i18n/locale";
import { ChatPanel } from "./ChatPanel";

async function fakeAction() {
  return { tone: "info" as const, messageKey: "unsupported" as const };
}

function render(locale: Locale, messages: typeof en | typeof ro, maxLength = 500) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ChatPanel action={fakeAction} maxLength={maxLength} />
    </NextIntlClientProvider>,
  );
}

describe("ChatPanel", () => {
  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("renders a textarea named message with the given maxlength and a submit button (CV-3, %s)", (locale, messages) => {
    const html = render(locale, messages);
    expect(html).toContain('<textarea name="message"');
    expect(html).toContain('maxLength="500"');
    expect(html).toContain(messages.Chat.send);
  });

  it("CV-4: no non-test file under components/chat/ has a specifier resolving under lib/ai", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const { extractModuleSpecifiers } = await import("../../test/helpers/module-specifiers");
    const dir = path.join(__dirname);
    const files = readdirSync(dir, { recursive: true })
      .filter((f): f is string => typeof f === "string")
      .filter((f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"));
    for (const file of files) {
      const source = readFileSync(path.join(dir, file), "utf8");
      for (const specifier of extractModuleSpecifiers(source)) {
        expect(specifier.includes("lib/ai"), `${file} imports ${specifier}`).toBe(false);
      }
    }
  });
});
