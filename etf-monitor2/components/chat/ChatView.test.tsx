import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ro from "@/messages/ro.json";
import type { Locale } from "@/i18n/locale";
import { CONFIGURATION_ACTIONS, type ConfigurationAction } from "@/lib/ai/capabilities/configuration/intent";
import { WIDGET_ACTIONS } from "@/lib/ai/capabilities/widgets/capability";
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

  const instructionKeys = {
    add_etf: "addEtf",
    remove_etf: "removeEtf",
    track_field: "trackField",
    untrack_field: "untrackField",
  } as const satisfies Record<ConfigurationAction, keyof typeof en.Chat.instructions>;

  it("US-045: both locales advertise the registered configuration and widget actions", () => {
    expect(Object.keys(instructionKeys)).toEqual([...CONFIGURATION_ACTIONS]);
    expect(Object.keys(en.Chat.instructions)).toEqual(Object.keys(ro.Chat.instructions));
    expect(["widgetAdd", "widgetUpdate", "widgetClear", "widgetReplace"]).toHaveLength(WIDGET_ACTIONS.length);
    for (const key of ["widgetAdd", "widgetUpdate", "widgetClear", "widgetReplace"] as const) {
      expect(en.Chat.instructions[key]).toBeTruthy();
      expect(ro.Chat.instructions[key]).toBeTruthy();
    }
    expect(en.Chat.instructions.multiAction).toContain("five");
    expect(ro.Chat.instructions.multiAction).toContain("cinci");
  });

  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("US-045: %s instructions appear in every availability state without a key input", (locale, messages) => {
    for (const state of [
      { status: "available" } as const,
      { status: "unavailable", reply: { tone: "info", messageKey: "unavailableNoModel", adminLink: true } } as const,
      { status: "error" } as const,
    ] satisfies ChatViewState[]) {
      const html = render(locale, messages, state);
      expect(html).toContain(messages.Chat.instructions.heading);
      expect(html).toContain(messages.Chat.instructions.intro);
      for (const key of Object.values(instructionKeys)) {
        expect(html).toContain(messages.Chat.instructions[key]);
      }
      for (const key of ["widgetAdd", "widgetUpdate", "widgetClear", "widgetReplace", "multiAction", "listExamples"] as const) {
        expect(html).toContain(messages.Chat.instructions[key]);
      }
      expect(html).toContain(messages.Chat.instructions.keyGuidance);
      expect(html).toContain('href="/admin/ai"');
      expect(html).not.toMatch(/name="(?:key|apiKey|baseUrl)"/i);
      expect(html).not.toContain("<input");
    }
  });

  it("US-045: localized instructions stay within supported widget and action-count behavior", () => {
    for (const messages of [en, ro]) {
      const guidance = Object.values(messages.Chat.instructions).join(" ").toLowerCase();
      expect(guidance).toMatch(/custom|personalizat/);
      expect(guidance).not.toMatch(/raw.field|câmp brut|formula|html/i);
      expect(guidance).toMatch(/five|cinci/);
    }
  });
});
