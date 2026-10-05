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

describe("ChatReply markup golden (G-C1, US-051 AC4, written before the C13 refactor)", () => {
  const withEverything: ChatReplyState = {
    tone: "success",
    messageKey: "tracked",
    values: { symbol: "BTBETRETF" },
    field: { ro: "Activ net", en: "Net asset" },
    detectionReason: "no_match",
  };
  it.each(["ro", "en"] as const)("G-C1 single reply with values+field+detectionReason (%s)", (locale) => {
    expect(render(locale, locale === "ro" ? ro : en, withEverything)).toMatchSnapshot();
  });

  it("G-C1 adminLink", () => {
    expect(render("en", en, { tone: "info", messageKey: "unavailableNotConfigured", adminLink: true })).toMatchSnapshot();
  });

  it("G-C1 error tone", () => {
    expect(render("en", en, { tone: "error", messageKey: "genericError" })).toMatchSnapshot();
  });

  it("G-C1 actions list, one with field, one with detectionReason, statuses done/failed/not_run", () => {
    const reply: ChatReplyState = {
      tone: "error",
      messageKey: "actionsPartial",
      actions: [
        { index: 1, status: "done", messageKey: "tracked", values: { symbol: "BTBETRETF" }, field: { ro: "Activ net", en: "Net asset" } },
        { index: 2, status: "failed", messageKey: "addedNoAdapter", values: { symbol: "XYZ" }, detectionReason: "no_match" },
        { index: 3, status: "not_run", messageKey: "actionNotRun", values: { symbol: "PTENGETF" } },
      ],
    };
    expect(render("en", en, reply)).toMatchSnapshot();
    expect(render("ro", ro, reply)).toMatchSnapshot();
  });
});
