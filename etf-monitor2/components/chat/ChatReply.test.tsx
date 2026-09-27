import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ro from "@/messages/ro.json";
import type { Locale } from "@/i18n/locale";
import type { ChatReplyState } from "./chat-state";
import { ChatReply } from "./ChatReply";

function render(locale: Locale, messages: typeof en | typeof ro, reply: ChatReplyState) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ChatReply reply={reply} />
    </NextIntlClientProvider>,
  );
}

describe("ChatReply", () => {
  it("CV-1: renders the field label in the UI locale, not the other one", () => {
    const reply: ChatReplyState = {
      tone: "success",
      messageKey: "tracked",
      values: { symbol: "BTBETRETF" },
      field: { ro: "Activ net", en: "Net asset" },
    };
    const roHtml = render("ro", ro, reply);
    const enHtml = render("en", en, reply);
    expect(roHtml).toContain("Activ net");
    expect(roHtml).not.toContain("Net asset");
    expect(enHtml).toContain("Net asset");
    expect(enHtml).not.toContain("Activ net");
  });

  it("addedNoAdapter shows the translated detection reason in parentheses", () => {
    const reply: ChatReplyState = {
      tone: "success",
      messageKey: "addedNoAdapter",
      values: { symbol: "XYZ" },
      detectionReason: "no_match",
    };
    const html = render("en", en, reply);
    expect(html).toContain(en.Admin.detectionReason.no_match);
  });

  it("adminLink renders a link to /admin/ai with the translated label", () => {
    const reply: ChatReplyState = { tone: "info", messageKey: "unavailableNotConfigured", adminLink: true };
    const html = render("en", en, reply);
    expect(html).toContain('href="/admin/ai"');
    expect(html).toContain(en.Chat.adminAiLink);
  });

  it("no adminLink means no link", () => {
    const reply: ChatReplyState = { tone: "info", messageKey: "unsupported" };
    const html = render("en", en, reply);
    expect(html).not.toContain('href="/admin/ai"');
  });

  it("CV-2: no sentinel leaks into the rendered HTML", () => {
    const reply: ChatReplyState = { tone: "success", messageKey: "added", values: { symbol: "XYZ", adapter: "brd-depositary" } };
    const html = render("en", en, reply);
    expect(html).not.toContain("ZQ-SENTINEL");
  });

  it("error tone uses role=alert, others use role=status", () => {
    const errorHtml = render("en", en, { tone: "error", messageKey: "genericError" });
    expect(errorHtml).toContain('role="alert"');
    const infoHtml = render("en", en, { tone: "info", messageKey: "unsupported" });
    expect(infoHtml).toContain('role="status"');
  });
});
