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
    <NextIntlClientProvider locale={locale} timeZone="UTC" messages={messages}>
      <ChatReply reply={reply} />
    </NextIntlClientProvider>,
  );
}

describe("ChatReply model text + result list (CRC, US-055 AC2/AC3)", () => {
  it("CRC-1: injected HTML/script in modelText renders as escaped text, never executes or links", () => {
    const reply: ChatReplyState = {
      tone: "success",
      messageKey: "actionsComplete",
      modelText: '<script>alert(1)</script><b>x</b> https://evil.example',
    };
    const html = render("en", en, reply);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<b>");
    expect(html).not.toContain('href="https://evil.example"');
  });

  it("CRC-2: the 'What the app did' heading sits between the reply and the result list, only when both are present", () => {
    const reply: ChatReplyState = {
      tone: "success",
      messageKey: "actionsComplete",
      modelText: "Done.",
      actions: [{ index: 1, status: "done", messageKey: "widgetAdded", values: { symbol: "XYZ" } }],
    };
    const html = render("en", en, reply);
    const replyIndex = html.indexOf("Done.");
    const headingIndex = html.indexOf(en.Chat.resultsHeading);
    const listIndex = html.indexOf("<ul");
    expect(replyIndex).toBeGreaterThanOrEqual(0);
    expect(headingIndex).toBeGreaterThan(replyIndex);
    expect(listIndex).toBeGreaterThan(headingIndex);

    const noHeading = render("en", en, { tone: "success", messageKey: "actionsComplete", actions: reply.actions });
    expect(noHeading).not.toContain(en.Chat.resultsHeading);
  });

  it("CRC-3: a reported-done model reply does not hide an actual failure's reason text", () => {
    const reply: ChatReplyState = {
      tone: "info",
      messageKey: "invalidAction",
      values: { index: 1 },
      reason: { key: "unknownField", field: { ro: "VUAN", en: "navValue" } },
    };
    const html = render("en", en, reply);
    expect(html).toContain("is not a known field");
  });

  it("CRC-4: warning:true renders the partial-warning text above the result list", () => {
    const reply: ChatReplyState = {
      tone: "error",
      messageKey: "actionsPartial",
      modelText: "I did both.",
      warning: true,
      actions: [{ index: 1, status: "failed", messageKey: "actionFailed", values: { symbol: "XYZ" } }],
    };
    const html = render("en", en, reply);
    expect(html).toContain(en.Chat.partialWarning);
    const warningIndex = html.indexOf(en.Chat.partialWarning);
    const listIndex = html.indexOf("<ul");
    expect(listIndex).toBeGreaterThan(warningIndex);
  });

  it("CRC-5: a widget line's 'what' parenthetical shows operation, field and pluralised period, in the UI locale", () => {
    const action = {
      index: 1,
      status: "done" as const,
      messageKey: "widgetAdded" as const,
      values: { symbol: "BTBETRETF" },
      what: { operation: "max" as const, field: { ro: "Unități în circulație", en: "Units in circulation" }, periodUnit: "days" as const, periodAmount: 7 },
    };
    const reply: ChatReplyState = { tone: "success", messageKey: "actionsComplete", actions: [action] };
    const enHtml = render("en", en, reply);
    expect(enHtml).toContain("Units in circulation");
    expect(enHtml).toContain("7");
    const roHtml = render("ro", ro, reply);
    expect(roHtml).toContain("Unități în circulație");
  });

  it("CRC-6: a widget_update 'to' target renders after an arrow", () => {
    const action = {
      index: 1,
      status: "done" as const,
      messageKey: "widgetUpdated" as const,
      values: { symbol: "BTBETRETF" },
      what: {
        slot: 2 as const,
        to: { periodUnit: "days" as const, periodAmount: 90 },
      },
    };
    const reply: ChatReplyState = { tone: "success", messageKey: "actionsComplete", actions: [action] };
    const html = render("en", en, reply);
    expect(html).toContain("→");
    expect(html).toContain("90");
  });
});
