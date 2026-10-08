import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import ro from "../../../messages/ro.json";
import type { Locale } from "@/i18n/locale";
import { ActionMessage } from "@/components/admin/ActionMessage";
import { createDefaultProviderRegistry } from "@/lib/ai/providers/default-registry";
import { OPENAI_CHAT_COMPLETIONS_URL } from "@/lib/ai/providers/openai-compatible";

const SENTINEL_RAW_BODY = "RAW-PROVIDER-TEXT-SENTINEL";
const SENTINEL_KEY = "SENTINEL-FLOW-KEY-7af1";

let fakeFetch: ReturnType<typeof vi.fn>;

vi.mock("@/lib/ai/provider-deps", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai/provider-deps")>();
  return {
    ...original,
    createProviderDeps: () => ({
      loadSettings: async () => ({ provider: "openai", model: "gpt-4.1" }),
      loadStoredKeys: async () => new Map(),
      registry: createDefaultProviderRegistry(),
      readApiKey: () => SENTINEL_KEY,
      fetch: (...args: Parameters<typeof fakeFetch>) => fakeFetch(...args),
    }),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

function renderMessage(locale: Locale, messages: typeof en | typeof ro, state: Awaited<ReturnType<typeof importAction>>) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ActionMessage state={state} />
    </NextIntlClientProvider>,
  );
}

async function importAction() {
  const { testConnectionAction } = await import("./actions");
  return testConnectionAction({ status: "idle" }, new FormData());
}

describe("testConnectionAction flow (TF)", () => {
  it.each([
    ["en", en] as const,
    ["ro", ro] as const,
  ])("TF-1 (%s): success shows connectionOk", async (locale, messages) => {
    fakeFetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }));
    const state = await importAction();
    expect(state).toEqual({ status: "success", messageKey: "connectionOk" });
    const html = renderMessage(locale, messages, state);
    expect(html).toContain(messages.Admin.messages.connectionOk);
  });

  it.each([
    [401, "auth_failed"],
    [429, "rate_limited"],
    [404, "model_not_found"],
  ] as const)("TF-2 (%i): HTML contains the closed code and neither the raw provider text nor the key", async (status, code) => {
    fakeFetch = vi.fn(async (url: string) => {
      expect(url).toBe(OPENAI_CHAT_COMPLETIONS_URL);
      return new Response(JSON.stringify({ error: `${SENTINEL_RAW_BODY} ${SENTINEL_KEY}` }), { status });
    });
    const state = await importAction();
    expect(state).toEqual({ status: "error", messageKey: "connectionFailed", values: { code } });
    const html = renderMessage("en", en, state);
    expect(html).toContain(code);
    expect(html).not.toContain(SENTINEL_RAW_BODY);
    expect(html).not.toContain(SENTINEL_KEY);
  });
});
