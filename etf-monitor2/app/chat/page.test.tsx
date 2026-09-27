import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import ro from "@/messages/ro.json";
import type { Locale } from "@/i18n/locale";
import { CHAT_UNAVAILABLE_REASONS, type ChatAvailability } from "@/lib/ai/chat";

let mockAvailability: () => Promise<ChatAvailability> = async () => ({ status: "available" });

vi.mock("@/lib/ai/chat", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai/chat")>();
  return { ...original, getChatAvailability: () => mockAvailability() };
});
vi.mock("./actions", () => ({ sendChatMessageAction: vi.fn() }));

afterEach(() => {
  mockAvailability = async () => ({ status: "available" });
});

async function renderPage(locale: Locale, messages: typeof en | typeof ro) {
  const { default: Page } = await import("./page");
  const element = await Page();
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {element}
    </NextIntlClientProvider>,
  );
}

describe("Chat page (AC1, AC6)", () => {
  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("CPG-1: renders the heading, a textarea named message with maxlength=500, and a send button, in %s", async (locale, messages) => {
    const html = await renderPage(locale, messages);
    expect(html).toContain(messages.Chat.heading);
    expect(html).toContain('<textarea name="message"');
    expect(html).toContain('maxLength="500"');
    expect(html).toContain(messages.Chat.send);
    const names = [...html.matchAll(/<(?:input|textarea|select)[^>]*\bname="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(names)).toEqual(new Set(["message"]));
  });

  it("ro and en never mix each other's heading", async () => {
    const roHtml = await renderPage("ro", ro);
    const enHtml = await renderPage("en", en);
    expect(roHtml).not.toContain(en.Chat.heading);
    expect(enHtml).not.toContain(ro.Chat.heading);
  });

  it("CPG-4: exports dynamic = force-dynamic and maxDuration = 60", async () => {
    const mod = await import("./page");
    expect(mod.dynamic).toBe("force-dynamic");
    expect(mod.maxDuration).toBe(60);
  });

  it("CPG-4b: an ETF add through /chat fits inside maxDuration (US-029 AC9 ordering)", async () => {
    const mod = await import("./page");
    const { AI_PROVIDER_TIMEOUT_MS } = await import("@/lib/ai/providers/run-generation");
    const { CRON_FETCH_TIMEOUT_MS, MAX_REQUESTS_PER_ETF } = await import("@/lib/ingestion/run-daily");
    const NON_FETCH_ALLOWANCE_MS = 15_000;
    const budget = AI_PROVIDER_TIMEOUT_MS + MAX_REQUESTS_PER_ETF * CRON_FETCH_TIMEOUT_MS + NON_FETCH_ALLOWANCE_MS;
    expect(budget).toBeLessThanOrEqual(mod.maxDuration * 1000);
  });

  const UNAVAILABLE_MESSAGE_KEY = {
    not_configured: "unavailableNotConfigured",
    unknown_provider: "unavailableUnknownProvider",
    not_implemented: "unavailableNotImplemented",
    no_api_key: "unavailableNoApiKey",
    no_model: "unavailableNoModel",
  } as const;

  it.each(CHAT_UNAVAILABLE_REASONS)("CPG-2: unavailable reason %s shows its translated reply and a link, no textarea", async (reason) => {
    mockAvailability = async () => ({ status: "unavailable", reason });
    const html = await renderPage("en", en);
    expect(html).not.toContain("<textarea");
    expect(html).toContain('href="/admin/ai"');
    expect(html).toContain(en.Chat.replies[UNAVAILABLE_MESSAGE_KEY[reason]]);
  });

  it("error status shows Chat.loadError and no textarea", async () => {
    mockAvailability = async () => ({ status: "error" });
    const html = await renderPage("en", en);
    expect(html).toContain(en.Chat.loadError);
    expect(html).not.toContain("<textarea");
  });
});
