import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildTestContext } from "../../test/helpers/ai-config-context";
import { createFakeProvider } from "../../test/helpers/ai-fakes";
import { createProviderRegistry } from "./providers/registry";
import { geminiProvider } from "./providers/gemini";
import { createFormatCache } from "./model-call";
import type { ProviderDeps } from "./provider-deps";
import type { ChatDeps } from "./chat";
import type { ExecutionOutcome } from "./capabilities/configuration/execute";

vi.mock("./capabilities/configuration/context", () => ({
  loadConfigurationContext: vi.fn(async () => buildTestContext()),
}));
vi.mock("./capabilities/configuration/execute", async (importOriginal) => ({
  configurationOutcomeFailed: (await importOriginal<typeof import("./capabilities/configuration/execute")>()).configurationOutcomeFailed,
  executeConfigurationIntent: vi.fn(async () => ({
    code: "tracked",
    symbol: "BTBETRETF",
    field: { fieldKey: "net_asset", labelRo: "Activ net", labelEn: "Net asset" },
    adapterKey: null,
    detectionReason: null,
    changed: true,
  })),
}));
vi.mock("./capabilities/widgets/context", async (importOriginal) => ({
  withWidgets: (await importOriginal<typeof import("./capabilities/widgets/context")>()).withWidgets,
  loadWidgetContext: vi.fn(async () => ({ etfs: buildTestContext().etfs.map((etf) => ({ symbol: etf.symbol, available: etf.available, widgets: [] })) })),
}));
vi.mock("./capabilities/widgets/execute", () => ({
  executeWidgetIntent: vi.fn(async () => ({ ok: true, outcome: { action: "widget_add", symbol: "BTBETRETF", changed: true, slot: 1 } })),
}));

import { executeConfigurationIntent } from "./capabilities/configuration/execute";
import { handleChatMessage } from "./chat";

const envelope = (actions: unknown[]) => JSON.stringify({ reply: "I can do that.", actions });

function makeDeps(fake: ReturnType<typeof createFakeProvider>): () => ChatDeps {
  const provider: ProviderDeps = {
    loadSettings: async () => ({ provider: "gemini", model: "m-1" }),
    loadStoredKeys: async () => new Map(),
    registry: createProviderRegistry([fake]),
    readApiKey: () => "fake-key-for-correction-test",
    fetch: vi.fn(async () => {
      throw new Error("real network forbidden");
    }),
  };
  return () => ({
    provider,
    config: {} as ChatDeps["config"],
    widgets: {} as ChatDeps["widgets"],
    planKey: () => new Uint8Array(32).fill(21),
  });
}

beforeEach(() => {
  vi.mocked(executeConfigurationIntent).mockReset().mockResolvedValue({
    code: "tracked",
    symbol: "BTBETRETF",
    field: { fieldKey: "net_asset", labelRo: "Activ net", labelEn: "Net asset" },
    adapterKey: null,
    detectionReason: null,
    changed: true,
  } satisfies ExecutionOutcome);
});

describe("chat self-correction round (US-058 AC4)", () => {
  it("retries one invalid action, grounds the correction only in the original user turn, and executes the corrected answer", async () => {
    const fake = createFakeProvider("gemini", [
      { ok: true, text: envelope([{ capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "unknown_model_field" }]) },
      { ok: true, text: envelope([{ capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "net_asset" }]) },
    ]);
    const outcome = await handleChatMessage("track net asset for BTBETRETF", makeDeps(fake));
    expect(outcome).toMatchObject({ kind: "executed_actions", results: [{ status: "done", action: "track_field", symbol: "BTBETRETF" }] });
    expect(fake.calls).toHaveLength(2);
    const correction = fake.calls[1]!.request.messages;
    expect(correction).toHaveLength(3);
    expect(correction[0]).toEqual({ role: "user", content: "track net asset for BTBETRETF" });
    expect(correction[1]?.role).toBe("assistant");
    expect(correction[2]?.content).toContain("action 1: unknown_field");
    expect(correction[2]?.content).not.toContain("unknown_model_field");
    expect(executeConfigurationIntent).toHaveBeenCalledTimes(1);
  });

  it("includes every validation failure in one correction request", async () => {
    const fake = createFakeProvider("gemini", [
      {
        ok: true,
        text: envelope([
          { capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "unknown_model_field" },
          { capability: "configuration", action: "remove_etf", symbol: "*" },
        ]),
      },
      { ok: true, text: envelope([{ capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "net_asset" }]) },
    ]);
    const outcome = await handleChatMessage(
      "track net asset for BTBETRETF and remove all ETFs",
      makeDeps(fake),
    );
    expect(outcome).toMatchObject({ kind: "executed_actions", results: [{ action: "track_field", status: "done" }] });
    expect(fake.calls).toHaveLength(2);
    const correction = fake.calls[1]!.request.messages[2]!.content;
    expect(correction).toContain("action 1: unknown_field (BTBETRETF)");
    expect(correction).toContain("action 2: all_not_allowed");
    expect(correction).not.toContain("unknown_model_field");
    expect(executeConfigurationIntent).toHaveBeenCalledOnce();
  });

  it("uses the real Gemini adapter through schema downgrade and correction within the three-call cap", async () => {
    const response = (text: string) => new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "unsupported response schema" } }), { status: 400 }))
      .mockResolvedValueOnce(response(envelope([
        { capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "unknown_model_field" },
        { capability: "configuration", action: "remove_etf", symbol: "*" },
      ])))
      .mockResolvedValueOnce(response(envelope([
        { capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "net_asset" },
      ])));
    const deps: ChatDeps = {
      provider: {
        loadSettings: async () => ({ provider: "gemini", model: "m-1" }),
        loadStoredKeys: async () => new Map(),
        registry: createProviderRegistry([geminiProvider]),
        readApiKey: () => "fake-key-for-correction-test",
        fetch,
      },
      config: {} as ChatDeps["config"],
      widgets: {} as ChatDeps["widgets"],
      planKey: () => new Uint8Array(32).fill(21),
      formatCache: createFormatCache(),
    };

    const outcome = await handleChatMessage(
      "track net asset for BTBETRETF and remove all ETFs",
      () => deps,
    );

    expect(outcome).toMatchObject({ kind: "executed_actions", results: [{ action: "track_field", status: "done" }] });
    expect(fetch).toHaveBeenCalledTimes(3);
    const requests = fetch.mock.calls.map(([, init]) => JSON.parse(String(init?.body)) as {
      generationConfig: { responseSchema?: unknown; responseMimeType?: string };
      contents: { role: string; parts: [{ text: string }] }[];
    });
    expect(requests[0]!.generationConfig.responseSchema).toBeDefined();
    expect(requests[1]!.generationConfig).toEqual({ maxOutputTokens: expect.any(Number), responseMimeType: "application/json" });
    expect(requests[2]!.generationConfig).toEqual({ maxOutputTokens: expect.any(Number), responseMimeType: "application/json" });
    const correction = requests[2]!.contents.at(-1)!.parts[0].text;
    expect(correction).toContain("action 1: unknown_field (BTBETRETF)");
    expect(correction).toContain("action 2: all_not_allowed");
    expect(correction).not.toContain("unknown_model_field");
    expect(executeConfigurationIntent).toHaveBeenCalledOnce();
  });

  it("returns only the second answer's failure after the single correction attempt", async () => {
    const fake = createFakeProvider("gemini", [
      { ok: true, text: envelope([{ capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "not-a-field" }]) },
      { ok: true, text: envelope([{ capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "still-not-a-field" }]) },
    ]);
    const outcome = await handleChatMessage("track net asset for BTBETRETF", makeDeps(fake));
    expect(outcome).toMatchObject({ kind: "invalid_action", reason: "unknown_field" });
    expect(fake.calls).toHaveLength(2);
    expect(executeConfigurationIntent).not.toHaveBeenCalled();
  });

  it("does not retry a provider failure or a successful answer", async () => {
    const providerFailure = createFakeProvider("gemini", [{ ok: false, error: "rate_limited" }]);
    expect(await handleChatMessage("track net asset for BTBETRETF", makeDeps(providerFailure)))
      .toMatchObject({ kind: "interpreted", outcome: { kind: "provider_error", error: "rate_limited" } });
    expect(providerFailure.calls).toHaveLength(1);

    const answer = createFakeProvider("gemini", [{ ok: true, text: JSON.stringify({ reply: "The tracked fields are net asset.", actions: [] }) }]);
    expect((await handleChatMessage("what fields are tracked?", makeDeps(answer))).kind).toBe("answered");
    expect(answer.calls).toHaveLength(1);
  });

  it("never sends a key-bearing answer to the correction call", async () => {
    const fake = createFakeProvider("gemini", [
      { ok: true, text: JSON.stringify({
        reply: "fake-key-for-correction-test",
        actions: [{ capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "not-a-field" }],
      }) },
    ]);
    const outcome = await handleChatMessage("track net asset for BTBETRETF", makeDeps(fake));
    expect(outcome).toMatchObject({ kind: "invalid_action", reason: "unknown_field" });
    expect(JSON.stringify(outcome)).not.toContain("fake-key-for-correction-test");
    expect(fake.calls).toHaveLength(1);
  });
});
