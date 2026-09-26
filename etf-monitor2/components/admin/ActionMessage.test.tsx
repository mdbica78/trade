import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ro from "../../messages/ro.json";
import type { Locale } from "@/i18n/locale";
import { ActionMessage } from "./ActionMessage";
import type { AdminActionState } from "./action-state";

function render(locale: Locale, messages: typeof ro | typeof en, state: AdminActionState) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ActionMessage state={state} />
    </NextIntlClientProvider>,
  );
}

describe("ActionMessage", () => {
  it("renders nothing for idle", () => {
    expect(render("en", en, { status: "idle" })).toBe("");
  });

  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("renders the translated success message with interpolation (%s)", (locale, messages) => {
    const html = render(locale, messages, {
      status: "success",
      messageKey: "added",
      values: { symbol: "BTBETRETF", adapter: "brd-depositary" },
    });
    expect(html).toContain("BTBETRETF");
    expect(html).toContain("brd-depositary");
    expect(html).toContain('role="status"');
  });

  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("renders an alert role and the detection reason for an error state (%s)", (locale, messages) => {
    const html = render(locale, messages, {
      status: "error",
      messageKey: "notFound",
      values: { symbol: "NOPE" },
    });
    expect(html).toContain('role="alert"');
    expect(html).toContain(messages.Admin.messages.notFound.replace("{symbol}", "NOPE"));
  });

  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("appends the translated detection reason when present (%s)", (locale, messages) => {
    const html = render(locale, messages, {
      status: "success",
      messageKey: "notDetected",
      values: { symbol: "BTBETRETF" },
      reason: "fetch_error",
    });
    expect(html).toContain(messages.Admin.detectionReason.fetch_error);
  });
});
