import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import ro from "@/messages/ro.json";
import type { Locale } from "@/i18n/locale";

const SENTINEL = "postgres://user:SENTINELPW@host/db";

vi.mock("@/lib/db", () => ({
  getDb: () => {
    const err = Object.assign(new Error(`connection refused ${SENTINEL}`), { name: "NeonDbError", code: "ECONNREFUSED" });
    throw err;
  },
}));
vi.mock("./actions", () => ({ sendChatMessageAction: vi.fn(), confirmChatPlanAction: vi.fn() }));

async function renderPage(locale: Locale, messages: typeof en | typeof ro) {
  const { default: Page } = await import("./page");
  const element = await Page();
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {element}
    </NextIntlClientProvider>,
  );
}

describe("Chat page load-error path (LE-P5)", () => {
  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("LE-P5 (%s): getDb() throwing inside getChatAvailability logs exactly one safe chat line and shows the translated error", async (locale, messages) => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const html = await renderPage(locale, messages);

    const lines = spy.mock.calls.filter((c) => typeof c[0] === "string" && c[0].startsWith("[load-error]"));
    spy.mockRestore();

    expect(html).toContain(messages.Chat.loadError);
    expect(html).not.toContain("SENTINELPW");
    expect(html).not.toContain("://");
    expect(lines).toHaveLength(1);
    expect(lines[0][0]).toMatch(/^\[load-error\] chat /);
    expect(lines[0][0]).not.toContain("SENTINELPW");
  });
});
