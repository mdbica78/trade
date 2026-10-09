import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeProvider } from "../../test/helpers/ai-fakes";
import { buildTestContext } from "../../test/helpers/ai-config-context";
import { createProviderRegistry } from "./providers/registry";
import type { ProviderDeps } from "./provider-deps";
import type { ChatDeps } from "./chat";
import type { ExecutionOutcome } from "./capabilities/configuration/execute";
import type { WidgetExecutionResult } from "./capabilities/widgets/execute";

vi.mock("./capabilities/configuration/context", () => ({
  loadConfigurationContext: vi.fn(async () => buildTestContext()),
}));
vi.mock("./capabilities/configuration/execute", async (importOriginal) => ({
  configurationOutcomeFailed: (await importOriginal<typeof import("./capabilities/configuration/execute")>()).configurationOutcomeFailed,
  executeConfigurationIntent: vi.fn(async () => ({
    code: "added",
    symbol: "XYZ",
    field: null,
    adapterKey: null,
    detectionReason: null,
    changed: true,
  })),
}));
vi.mock("./capabilities/widgets/context", async (importOriginal) => ({
  withWidgets: (await importOriginal<typeof import("./capabilities/widgets/context")>()).withWidgets,
  loadWidgetContext: vi.fn(async () => ({
    etfs: [{ symbol: "BTBETRETF", available: buildTestContext().etfs[0]!.available, widgets: [] }],
  })),
}));
vi.mock("./capabilities/widgets/execute", () => ({
  executeWidgetIntent: vi.fn(async () => ({
    ok: true,
    outcome: { action: "widget_add", symbol: "XYZ", changed: true, slot: 1 },
  })),
}));

import { loadConfigurationContext } from "./capabilities/configuration/context";
import { executeConfigurationIntent } from "./capabilities/configuration/execute";
import { loadWidgetContext } from "./capabilities/widgets/context";
import { executeWidgetIntent } from "./capabilities/widgets/execute";
import { confirmChatPlan, handleChatMessage } from "./chat";
import { PLAN_TOKEN_TTL_MS } from "./chat-plan";

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn(async () => {
    throw new Error("real network forbidden");
  });
  vi.stubGlobal("fetch", fetchSpy);
  vi.mocked(loadConfigurationContext).mockClear();
  vi.mocked(executeConfigurationIntent).mockReset().mockResolvedValue({
    code: "added",
    symbol: "XYZ",
    field: null,
    adapterKey: null,
    detectionReason: null,
    changed: true,
  } satisfies ExecutionOutcome);
  vi.mocked(loadWidgetContext).mockClear();
  vi.mocked(executeWidgetIntent).mockReset().mockResolvedValue({
    ok: true,
    outcome: { action: "widget_add", symbol: "BTBETRETF", changed: true, slot: 1 },
  } satisfies WidgetExecutionResult);
});

function makeDeps(fake: ReturnType<typeof createFakeProvider>, overrides: Partial<ProviderDeps> = {}): () => ChatDeps {
  const provider: ProviderDeps = {
    loadSettings: async () => ({ provider: "gemini", model: "m-1" }),
    loadStoredKeys: async () => new Map(),
    registry: createProviderRegistry([fake]),
    readApiKey: () => "k-test",
    fetch: fetchSpy,
    ...overrides,
  };
  return () => ({
    provider,
    config: {} as ChatDeps["config"],
    widgets: {} as ChatDeps["widgets"],
    planKey: () => new Uint8Array(32).fill(7),
  });
}

const envelope = (object: Record<string, unknown>) => JSON.stringify(object);
const historyOf = (...turns: { role: "user" | "assistant"; content: string }[]) => JSON.stringify(turns);

describe("handleChatMessage conversation behaviour (CC, US-055)", () => {
  it("CC-1: a successful request's natural reply is returned verbatim in the outcome", async () => {
    const fake = createFakeProvider("gemini", [
      { ok: true, text: envelope({ reply: "Adaug ETF-ul XYZ.", actions: [{ capability: "configuration", action: "add_etf", symbol: "XYZ", name: null }] }) },
    ]);
    const outcome = await handleChatMessage("adaugă ETF-ul XYZ", makeDeps(fake));
    expect(outcome.kind).toBe("executed_actions");
    if (outcome.kind !== "executed_actions") return;
    expect(outcome.reply).toBe("Adaug ETF-ul XYZ.");
  });

  it("CC-2: a question-only reply becomes 'answered' with the question text, no execute call", async () => {
    const fake = createFakeProvider("gemini", [{ ok: true, text: envelope({ question: "Peste câte zile?" }) }]);
    const outcome = await handleChatMessage("adaugă media", makeDeps(fake));
    expect(outcome).toEqual({ kind: "answered", reply: null, question: "Peste câte zile?" });
    expect(executeConfigurationIntent).not.toHaveBeenCalled();
    expect(executeWidgetIntent).not.toHaveBeenCalled();
  });

  it("CC-3: a reply claiming 'done' alongside an invalid action is dropped; invalid_action never carries model text", async () => {
    const fake = createFakeProvider("gemini", [
      {
        ok: true,
        text: envelope({
          reply: "Done! I added it and tracked the field.",
          actions: [
            { capability: "configuration", action: "add_etf", symbol: "XYZ", name: null },
            { capability: "configuration", action: "track_field", symbol: "XYZ", field: "not-a-real-field" },
          ],
        }),
      },
    ]);
    const outcome = await handleChatMessage("add XYZ and track a field", makeDeps(fake));
    expect(outcome.kind).toBe("invalid_action");
    expect(JSON.stringify(outcome)).not.toContain("Done!");
    expect(executeConfigurationIntent).not.toHaveBeenCalled();
  });

  it("CC-4: an execution failure keeps the model reply but marks results failed/not_run, no false success", async () => {
    // US-058: remove_etf needs confirmation first (DEC-027 §4); propose, then confirm, then
    // check the executed outcome.
    vi.mocked(executeConfigurationIntent).mockRejectedValueOnce(new Error("boom"));
    const fake = createFakeProvider("gemini", [
      {
        ok: true,
        text: envelope({
          reply: "I'll remove it and add a widget.",
          actions: [
            { capability: "configuration", action: "remove_etf", symbol: "BTBETRETF" },
            { capability: "widgets", action: "widget_add", etf: "BTBETRETF", definition: { operation: "max", fieldKey: "units_in_circulation", periodUnit: "days", periodAmount: 7 } },
          ],
        }),
      },
    ]);
    const deps = makeDeps(fake);
    const proposed = await handleChatMessage("remove BTBETRETF and add a widget", deps);
    expect(proposed.kind).toBe("proposed");
    if (proposed.kind !== "proposed") return;
    const outcome = await confirmChatPlan(proposed.token, deps);
    expect(outcome.kind).toBe("executed_actions");
    if (outcome.kind !== "executed_actions") return;
    expect(outcome.results.map((r) => r.status)).toEqual(["failed", "not_run"]);
  });

  it("CC-5: the provider request's history has at most 21 turns + the current message, oldest dropped", async () => {
    // US-058: a bare {reply:null, actions:[]} envelope is "malformed" (nothing to answer or run)
    // and would trigger a correction call; use a valid answer envelope so this stays a 1-call test.
    const fake = createFakeProvider("gemini", [{ ok: true, text: envelope({ reply: "ok", actions: [] }) }]);
    const raw = Array.from({ length: 22 }, (_, i) => ({ role: "user" as const, content: `m${i}` }));
    await handleChatMessage("latest message", makeDeps(fake), { history: historyOf(...raw) });
    expect(fake.calls).toHaveLength(1);
    const messages = fake.calls[0]!.request.messages;
    expect(messages).toHaveLength(22); // 21 history + current
    expect(messages[0]!.content).toBe("m1");
    expect(messages.at(-1)).toEqual({ role: "user", content: "latest message" });
  });

  it("CC-6: an envelope with a question and empty actions is answered, nothing executed", async () => {
    const fake = createFakeProvider("gemini", [{ ok: true, text: envelope({ question: "Which field?", actions: [] }) }]);
    const outcome = await handleChatMessage("clear the custom value", makeDeps(fake));
    expect(outcome).toEqual({ kind: "answered", reply: null, question: "Which field?" });
    expect(executeConfigurationIntent).not.toHaveBeenCalled();
  });

  it("CC-7: a question with non-empty actions drops the actions (nothing executes)", async () => {
    const fake = createFakeProvider("gemini", [
      {
        ok: true,
        text: envelope({
          question: "Confirm?",
          actions: [{ capability: "configuration", action: "add_etf", symbol: "XYZ", name: null }],
        }),
      },
    ]);
    const outcome = await handleChatMessage("add XYZ", makeDeps(fake));
    expect(outcome).toEqual({ kind: "answered", reply: null, question: "Confirm?" });
    expect(executeConfigurationIntent).not.toHaveBeenCalled();
  });

  it("CC-8: a setup-question reply with no actions never calls execute", async () => {
    const fake = createFakeProvider("gemini", [
      { ok: true, text: envelope({ reply: "The active ETFs are BTBETRETF and TVBETETF.", actions: [] }) },
    ]);
    const outcome = await handleChatMessage("which ETFs are active?", makeDeps(fake));
    expect(outcome).toEqual({ kind: "answered", reply: "The active ETFs are BTBETRETF and TVBETETF.", question: null });
    expect(executeConfigurationIntent).not.toHaveBeenCalled();
    expect(executeWidgetIntent).not.toHaveBeenCalled();
  });

  it("CC-9: a 2000-char message is sent whole as the final user turn", async () => {
    const fake = createFakeProvider("gemini", [{ ok: true, text: envelope({ reply: null, actions: [] }) }]);
    const msg = "a".repeat(2000);
    const outcome = await handleChatMessage(msg, makeDeps(fake));
    expect(outcome.kind).not.toBe("invalid_message");
    expect(fake.calls[0]!.request.messages.at(-1)).toEqual({ role: "user", content: msg });
  });

  it("CC-10: a key request with a non-empty history is still refused before any deps/provider call", async () => {
    const depsFactory = vi.fn(makeDeps(createFakeProvider("gemini")));
    const outcome = await handleChatMessage("set my key to FAKE-KEY-ONLY-999", depsFactory, {
      history: historyOf({ role: "user", content: "earlier message" }),
    });
    expect(outcome).toEqual({ kind: "key_request" });
    expect(depsFactory).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("CC-11: a reply containing the active key is dropped before reaching the outcome", async () => {
    const fake = createFakeProvider("gemini", [{ ok: true, text: envelope({ reply: "Your key is SENTINEL-KEY-ABCDEFGH", actions: [] }) }]);
    const outcome = await handleChatMessage("what key am I using?", makeDeps(fake, { readApiKey: () => "SENTINEL-KEY-ABCDEFGH" }));
    expect(JSON.stringify(outcome)).not.toContain("SENTINEL-KEY-ABCDEFGH");
  });

  it("CC-12: no console output ever contains the message, history or reply text", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fake = createFakeProvider("gemini", [{ ok: true, text: envelope({ reply: "a normal reply", actions: [] }) }]);
    await handleChatMessage("SENTINEL-MESSAGE-TEXT", makeDeps(fake), {
      history: historyOf({ role: "user", content: "SENTINEL-HISTORY-TEXT" }),
    });
    const logged = spy.mock.calls.flat().map(String).join("\n");
    spy.mockRestore();
    expect(logged).not.toContain("SENTINEL-MESSAGE-TEXT");
    expect(logged).not.toContain("SENTINEL-HISTORY-TEXT");
  });

  it("CC-13: the request's messages are history + current; system is unaffected by history", async () => {
    const fake = createFakeProvider("gemini", [{ ok: true, text: envelope({ reply: null, actions: [] }) }]);
    await handleChatMessage("current message", makeDeps(fake), {
      history: historyOf({ role: "user", content: "h1" }, { role: "assistant", content: "[done]" }),
    });
    const request = fake.calls[0]!.request;
    // US-058/DEC-027: a catalogue provider registered as "gemini" uses structured json_schema output.
    expect(request.format).toBe("json_schema");
    expect(request.messages).toEqual([
      { role: "user", content: "h1" },
      { role: "assistant", content: "[done]" },
      { role: "user", content: "current message" },
    ]);
    expect(request.system).not.toContain("current message");
  });

  it("CC-14: grounding sees an ETF symbol named only in an earlier user turn", async () => {
    const fake = createFakeProvider("gemini", [
      { ok: true, text: envelope({ reply: "Adaug ETF-ul XYZ.", actions: [{ capability: "configuration", action: "add_etf", symbol: "XYZ", name: null }] }) },
    ]);
    const outcome = await handleChatMessage("adaugă-l", makeDeps(fake), {
      history: historyOf({ role: "user", content: "vreau să urmăresc ETF-ul XYZ" }),
    });
    expect(outcome.kind).toBe("executed_actions");
  });

  it("CF-7/CF-8 (US-058): proposal does not execute, confirmation runs that exact plan with no second model call", async () => {
    vi.mocked(executeConfigurationIntent).mockClear();
    const fake = createFakeProvider("gemini", [
      { ok: true, text: envelope({ reply: "Removing BTBETRETF.", actions: [{ capability: "configuration", action: "remove_etf", symbol: "BTBETRETF" }] }) },
      { ok: true, text: envelope({ reply: "A different answer.", actions: [] }) },
    ]);
    const deps = makeDeps(fake);
    const proposal = await handleChatMessage("remove ETF BTBETRETF", deps);
    expect(proposal.kind).toBe("proposed");
    if (proposal.kind !== "proposed") return;
    expect(proposal.results).toMatchObject([{ action: "remove_etf", symbol: "BTBETRETF", status: "proposed" }]);
    expect(executeConfigurationIntent).not.toHaveBeenCalled();
    expect(fake.calls).toHaveLength(1);

    const confirmed = await confirmChatPlan(proposal.token, deps);
    expect(confirmed).toMatchObject({ kind: "executed_actions", results: [{ action: "remove_etf", symbol: "BTBETRETF", status: "done" }] });
    expect(executeConfigurationIntent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(executeConfigurationIntent).mock.calls[0]?.[0]).toEqual({ action: "remove_etf", symbol: "BTBETRETF" });
    expect(fake.calls).toHaveLength(1);
  });

  it("CF-3/CF-4 (US-058): refuses confirmation after a dependency state change without executing", async () => {
    vi.mocked(executeConfigurationIntent).mockClear();
    const fake = createFakeProvider("gemini", [{
      ok: true,
      text: envelope({ reply: "I'll stop tracking net asset.", actions: [{ capability: "configuration", action: "untrack_field", symbol: "BTBETRETF", field: "units_in_circulation" }] }),
    }]);
    const deps = makeDeps(fake);
    const proposal = await handleChatMessage("stop tracking units in circulation for BTBETRETF", deps);
    expect(proposal.kind).toBe("proposed");
    if (proposal.kind !== "proposed") return;

    vi.mocked(loadConfigurationContext).mockResolvedValueOnce(buildTestContext({
      etfs: buildTestContext().etfs.map((etf) => etf.symbol === "BTBETRETF"
        ? { ...etf, tracked: etf.tracked.filter((field) => field.fieldKey !== "units_in_circulation") }
        : etf),
    }));
    expect(await confirmChatPlan(proposal.token, deps)).toEqual({ kind: "plan_refused", reason: "state_changed" });
    expect(executeConfigurationIntent).not.toHaveBeenCalled();
    expect(fake.calls).toHaveLength(1);
  });

  it.each([
    { reason: "tampered" as const, transform: (token: string) => `${token}x`, advanceMs: 0 },
    { reason: "expired" as const, transform: (token: string) => token, advanceMs: PLAN_TOKEN_TTL_MS + 1 },
  ])("CF-9/CF-10 (US-058): refuses $reason token at the confirmation service without loading state or executing", async ({ reason, transform, advanceMs }) => {
    vi.mocked(executeConfigurationIntent).mockClear();
    const fake = createFakeProvider("gemini", [{
      ok: true,
      text: envelope({ reply: "Removing BTBETRETF.", actions: [{ capability: "configuration", action: "remove_etf", symbol: "BTBETRETF" }] }),
    }]);
    const deps = makeDeps(fake);
    const proposal = await handleChatMessage("remove ETF BTBETRETF", deps);
    expect(proposal.kind).toBe("proposed");
    if (proposal.kind !== "proposed") return;

    const stateLoadsBeforeRefusal = vi.mocked(loadConfigurationContext).mock.calls.length;
    expect(await confirmChatPlan(transform(proposal.token), deps, { now: () => Date.now() + advanceMs }))
      .toEqual({ kind: "plan_refused", reason });
    expect(loadConfigurationContext).toHaveBeenCalledTimes(stateLoadsBeforeRefusal);
    expect(executeConfigurationIntent).not.toHaveBeenCalled();
    expect(fake.calls).toHaveLength(1);
  });
});
