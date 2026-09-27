import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ro from "@/messages/ro.json";
import type { Locale } from "@/i18n/locale";
import type { ChatViewState } from "./chat-state";
import { ChatView } from "./ChatView";

async function fakeAction() {
  return { tone: "info" as const, messageKey: "unsupported" as const };
}

function render(locale: Locale, messages: typeof en | typeof ro, state: ChatViewState) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ChatView state={state} action={fakeAction} maxLength={500} />
    </NextIntlClientProvider>,
  );
}

describe("ChatView (AC1, AC6)", () => {
  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("CPG-1: available renders the heading and the composer, in %s", (locale, messages) => {
    const html = render(locale, messages, { status: "available" });
    expect(html).toContain(messages.Chat.heading);
    expect(html).toContain('<textarea name="message"');
    expect(html).toContain(messages.Chat.send);
  });

  it("CPG-2: unavailable shows the reply text and a link to /admin/ai, no composer", () => {
    const html = render("en", en, {
      status: "unavailable",
      reply: { tone: "info", messageKey: "unavailableNoModel", adminLink: true },
    });
    expect(html).toContain(en.Chat.replies.unavailableNoModel);
    expect(html).toContain('href="/admin/ai"');
    expect(html).not.toContain("<textarea");
  });

  it("error shows Chat.loadError, no composer", () => {
    const html = render("en", en, { status: "error" });
    expect(html).toContain(en.Chat.loadError);
    expect(html).not.toContain("<textarea");
  });

  it("ro and en never mix each other's heading text", () => {
    const roHtml = render("ro", ro, { status: "available" });
    const enHtml = render("en", en, { status: "available" });
    expect(roHtml).not.toContain(en.Chat.heading);
    expect(enHtml).not.toContain(ro.Chat.heading);
  });
});
