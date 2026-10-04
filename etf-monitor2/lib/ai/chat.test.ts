import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeProvider } from "../../test/helpers/ai-fakes";
import { buildTestContext } from "../../test/helpers/ai-config-context";
import { createProviderRegistry } from "./providers/registry";
import { PROVIDER_ERROR_CODES } from "./providers/types";
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
vi.mock("./capabilities/widgets/context", () => ({
  loadWidgetContext: vi.fn(async () => ({
    etfs: [{
      symbol: "BTBETRETF",
      available: buildTestContext().etfs[0]!.available,
      widgets: [],
    }],
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
import { CHAT_MESSAGE_MAX_LENGTH, CHAT_UNAVAILABLE_REASONS, getChatAvailability, handleChatMessage } from "./chat";

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
  return () => ({ provider, config: {} as ChatDeps["config"], widgets: {} as ChatDeps["widgets"] });
}

const configurationOutput = (action: string, properties: Record<string, unknown>) =>
  JSON.stringify({ actions: [{ capability: "configuration", action, ...properties }] });
const actionListOutput = (...actions: unknown[]) => JSON.stringify({ actions });

describe("getChatAvailability error path (LE-C1)", () => {
  it("LE-C1: a sentinel-bearing throw from the deps factory logs exactly one safe chat line and returns status error", async () => {
    const SENTINEL = "postgres://user:SENTINELPW@host/db";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const availability = await getChatAvailability(() => {
      const err = Object.assign(new Error(`connection refused ${SENTINEL}`), { name: "NeonDbError", code: "ECONNREFUSED" });
      throw err;
    });

    const lines = spy.mock.calls.filter((c) => typeof c[0] === "string" && c[0].startsWith("[load-error]"));
    spy.mockRestore();

    expect(availability).toEqual({ status: "error" });
    expect(lines).toHaveLength(1);
    expect(lines[0][0]).toMatch(/^\[load-error\] chat /);
    expect(lines[0][0]).not.toContain("SENTINELPW");
  });
});

describe("handleChatMessage input limits (CE, AC8)", () => {
  it("CE-1: empty, whitespace-only and over-length messages are rejected before any deps call", async () => {
    const depsFactory = vi.fn(makeDeps(createFakeProvider("gemini")));
    for (const raw of ["", "   \n\t", "a".repeat(501), `  ${"a".repeat(501)}  `]) {
      const outcome = await handleChatMessage(raw, depsFactory);
      expect(outcome.kind).toBe("invalid_message");
    }
    expect(depsFactory).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  describe("provider key request refusal (US-042 AC3, DEC-021 §9)", () => {
    it.each([
      "set my API key to FAKE-KEY-ONLY-123",
      "replace provider key with FAKE-KEY-ONLY-123",
      "update Gemini key FAKE-KEY-ONLY-123",
      "setează cheia API FAKE-KEY-ONLY-123",
      "schimbă cheia de furnizor FAKE-KEY-ONLY-123",
      "setează cheia Gemini FAKE-KEY-ONLY-123",
      "setează cheia Groq FAKE-KEY-ONLY-123",
      "configurează cheia de la Groq FAKE-KEY-ONLY-123",
      "setează cheia FAKE-KEY-ONLY-123",
      "set my key to FAKE-KEY-ONLY-123",
    ])("refuses a provider-key request before dependency creation or provider calls", async (message) => {
      const depsFactory = vi.fn(makeDeps(createFakeProvider("gemini")));
      const outcome = await handleChatMessage(message, depsFactory);
      expect(outcome).toEqual({ kind: "key_request" });
      expect(JSON.stringify(outcome)).not.toContain("FAKE-KEY-ONLY-123");
      expect(depsFactory).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(loadConfigurationContext).not.toHaveBeenCalled();
      expect(executeConfigurationIntent).not.toHaveBeenCalled();
    });

    it.each([
      "Track nav_per_unit for BTBETRETF",
      "Change the tracked field for BTBETRETF",
    ])("does not reject an ordinary configuration request as a provider key request", async (message) => {
      const depsFactory = vi.fn(makeDeps(createFakeProvider("gemini")));
      await handleChatMessage(message, depsFactory);
      expect(depsFactory).toHaveBeenCalledOnce();
    });

    it("does not reject ordinary ETF and field configuration commands", async () => {
      const fake = createFakeProvider("gemini", [{ ok: true, text: '{"action":"unsupported"}' }]);
      await handleChatMessage("track net_asset for BTBETRETF", makeDeps(fake));
      expect(fake.calls).toHaveLength(1);
    });
  });

  it("CE-2: exactly 500 characters (trimmed) is accepted", async () => {
    const fake = createFakeProvider("gemini", [{ ok: true, text: '{"action":"unsupported"}' }]);
    const outcome = await handleChatMessage("a".repeat(500), makeDeps(fake));
    expect(outcome.kind).not.toBe("invalid_message");
    expect(fake.calls).toHaveLength(1);
  });

  it("CE-9: exactly one generate call and at most one execute call per message", async () => {
    const fake = createFakeProvider("gemini", [{ ok: true, text: configurationOutput("add_etf", { symbol: "XYZ", name: null }) }]);
    await handleChatMessage("add ETF XYZ", makeDeps(fake));
    expect(fake.calls).toHaveLength(1);
    expect(executeConfigurationIntent).toHaveBeenCalledTimes(1);
  });

  it("an unsupported outcome never calls execute", async () => {
    const fake = createFakeProvider("gemini", [{ ok: true, text: '{"action":"unsupported"}' }]);
    const outcome = await handleChatMessage("write me a poem", makeDeps(fake));
    expect(outcome.kind).toBe("interpreted");
    expect(executeConfigurationIntent).not.toHaveBeenCalled();
  });

  it("preflights a mixed action at every list position before any configuration or widget write", async () => {
    const validTrack = { capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "nav_per_unit" };
    const validWidget = {
      capability: "widgets",
      action: "widget_add",
      etf: "BTBETRETF",
      definition: { operation: "change", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7 },
    };
    const validActions = [validTrack, validWidget, validTrack];
    const invalidActions = [
      { capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "not_catalogued" },
      { ...validWidget, definition: { ...validWidget.definition, fieldKey: "not_catalogued" } },
      { capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "not_catalogued" },
    ];
    for (let invalidPosition = 0; invalidPosition < validActions.length; invalidPosition += 1) {
      const actions = [...validActions];
      actions[invalidPosition] = invalidActions[invalidPosition]!;
      vi.mocked(executeConfigurationIntent).mockClear();
      const fake = createFakeProvider("gemini", [{ ok: true, text: actionListOutput(...actions) }]);
      const outcome = await handleChatMessage("track VUAN for BTBETRETF and add a custom value for BTBETRETF", makeDeps(fake));
      expect(outcome).toMatchObject({ kind: "invalid_action", index: invalidPosition + 1 });
      expect(executeConfigurationIntent).not.toHaveBeenCalled();
      expect(vi.mocked(executeWidgetIntent)).not.toHaveBeenCalled();
    }
  });

  it("executes a valid mixed list in input order after preflight", async () => {
    const fake = createFakeProvider("gemini", [{
      ok: true,
      text: actionListOutput(
        { capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "nav_per_unit" },
        {
          capability: "widgets",
          action: "widget_add",
          etf: "BTBETRETF",
          definition: { operation: "change", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7 },
        },
      ),
    }]);
    const outcome = await handleChatMessage(
      "track VUAN and add a custom value for BTBETRETF",
      makeDeps(fake),
    );
    expect(outcome).toMatchObject({
      kind: "executed_actions",
      results: [{ status: "done", capability: "configuration" }, { status: "done", capability: "widgets" }],
    });
    expect(vi.mocked(executeConfigurationIntent).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(executeWidgetIntent).mock.invocationCallOrder[0]!);
  });

  it("executes widget actions before configuration actions when that is the requested order", async () => {
    const fake = createFakeProvider("gemini", [{
      ok: true,
      text: actionListOutput(
        {
          capability: "widgets",
          action: "widget_add",
          etf: "BTBETRETF",
          definition: { operation: "change", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7 },
        },
        { capability: "configuration", action: "remove_etf", symbol: "BTBETRETF" },
      ),
    }]);
    const outcome = await handleChatMessage(
      "add a custom value and stop monitoring BTBETRETF",
      makeDeps(fake),
    );
    expect(outcome).toMatchObject({
      kind: "executed_actions",
      results: [{ status: "done", capability: "widgets" }, { status: "done", capability: "configuration" }],
    });
    expect(vi.mocked(executeWidgetIntent).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(executeConfigurationIntent).mock.invocationCallOrder[0]!);
  });

  it("stops at runtime failure in each list position and reports ordered partial results safely", async () => {
    const actions = [
      { capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "net_asset" },
      {
        capability: "widgets",
        action: "widget_add",
        etf: "BTBETRETF",
        definition: { operation: "change", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7 },
      },
      { capability: "configuration", action: "remove_etf", symbol: "BTBETRETF" },
    ];
    const capabilities = ["configuration", "widgets", "configuration"];
    for (let failurePosition = 1; failurePosition <= actions.length; failurePosition += 1) {
      const calls: string[] = [];
      vi.mocked(executeConfigurationIntent).mockImplementation(async () => {
        calls.push("configuration");
        if (calls.length === failurePosition) throw new Error("secret-provider-or-database-detail");
        return {
          code: "added",
          symbol: "BTBETRETF",
          field: null,
          adapterKey: null,
          detectionReason: null,
          changed: true,
        };
      });
      vi.mocked(executeWidgetIntent).mockImplementation(async () => {
        calls.push("widgets");
        if (calls.length === failurePosition) throw new Error("secret-provider-or-database-detail");
        return { ok: true, outcome: { action: "widget_add", symbol: "BTBETRETF", changed: true, slot: 1 } };
      });
      const fake = createFakeProvider("gemini", [{ ok: true, text: actionListOutput(...actions) }]);
      const outcome = await handleChatMessage("track VUAN, add a custom value, and stop monitoring BTBETRETF", makeDeps(fake));
      expect(outcome).toMatchObject({
        kind: "executed_actions",
        results: [
          ...Array.from({ length: failurePosition - 1 }, () => ({ status: "done" })),
          { status: "failed", index: failurePosition },
          ...Array.from({ length: actions.length - failurePosition }, (_, index) => ({
            status: "not_run",
            index: failurePosition + index + 1,
          })),
        ],
      });
      expect(calls).toEqual(capabilities.slice(0, failurePosition));
      expect(JSON.stringify(outcome)).not.toContain("secret-provider");
    }
  });

  it.each(["add_rejected", "not_found", "field_not_available", "not_tracked"] as const)(
    "stops after a returned configuration failure (%s) instead of reporting success",
    async (code) => {
      const actions = [
        { capability: "configuration", action: "untrack_field", symbol: "BTBETRETF", field: "units_in_circulation" },
        { capability: "configuration", action: "untrack_field", symbol: "BTBETRETF", field: "units_in_circulation" },
        { capability: "configuration", action: "remove_etf", symbol: "BTBETRETF" },
      ];
      vi.mocked(executeConfigurationIntent)
        .mockResolvedValueOnce({
          code: "untracked", symbol: "BTBETRETF", field: null,
          adapterKey: null, detectionReason: null, changed: true,
        })
        .mockResolvedValueOnce({
          code, symbol: "BTBETRETF", field: null,
          adapterKey: null, detectionReason: null, changed: false,
        });
      const fake = createFakeProvider("gemini", [{ ok: true, text: actionListOutput(...actions) }]);
      const outcome = await handleChatMessage("untrack VUAN twice and remove BTBETRETF", makeDeps(fake));
      expect(outcome).toMatchObject({
        kind: "executed_actions",
        results: [
          { status: "done", changed: true },
          { status: "failed", changed: false, configuration: { code } },
          { status: "not_run", changed: false },
        ],
      });
      expect(executeConfigurationIntent).toHaveBeenCalledTimes(2);
    },
  );

  it.each(["already_monitored", "already_inactive", "already_tracked"] as const)(
    "retains intentional configuration no-op (%s) as done without a false failure",
    async (code) => {
      vi.mocked(executeConfigurationIntent).mockResolvedValueOnce({
        code, symbol: "BTBETRETF", field: null,
        adapterKey: null, detectionReason: null, changed: false,
      });
      const fake = createFakeProvider("gemini", [{
        ok: true, text: configurationOutput("remove_etf", { symbol: "BTBETRETF" }),
      }]);
      expect(await handleChatMessage("remove BTBETRETF", makeDeps(fake))).toMatchObject({
        kind: "executed_actions", results: [{ status: "done", changed: false, configuration: { code } }],
      });
    },
  );
});

const UNAVAILABLE_OVERRIDES: Record<(typeof CHAT_UNAVAILABLE_REASONS)[number], Partial<ProviderDeps>> = {
  not_configured: { loadSettings: async () => ({ provider: null, model: null }) },
  unknown_provider: { loadSettings: async () => ({ provider: "bogus-provider", model: "m-1" }) },
  not_implemented: {
    loadSettings: async () => ({ provider: "groq", model: "m-1" }),
    registry: createProviderRegistry([createFakeProvider("gemini")]),
  },
  no_api_key: { readApiKey: () => null },
  no_model: { loadSettings: async () => ({ provider: "gemini", model: null }) },
};

describe("handleChatMessage availability (CE, AC6)", () => {
  it.each(CHAT_UNAVAILABLE_REASONS)(
    "%s: unavailable, no generate call, no context load, database unchanged",
    async (reason) => {
      const fake = createFakeProvider("gemini");
      const deps = makeDeps(fake, UNAVAILABLE_OVERRIDES[reason]);
      const outcome = await handleChatMessage("add ETF XYZ", deps);
      expect(outcome).toEqual({ kind: "unavailable", reason });
      expect(fake.calls).toHaveLength(0);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(loadConfigurationContext).not.toHaveBeenCalled();
      expect(executeConfigurationIntent).not.toHaveBeenCalled();
    },
  );
});

describe("handleChatMessage provider errors never leak (CE, AC7)", () => {
  it.each(PROVIDER_ERROR_CODES)("CE-5: %s maps to interpreted/provider_error/%s", async (code) => {
    const fake = createFakeProvider("gemini", [{ ok: false, error: code }]);
    const outcome = await handleChatMessage("add ETF XYZ", makeDeps(fake));
    expect(outcome).toEqual({ kind: "interpreted", outcome: { kind: "provider_error", error: code } });
    expect(executeConfigurationIntent).not.toHaveBeenCalled();
  });

  it("CE-3: a throwing deps factory gives a bare error, no exception text leaks", async () => {
    const sentinel = new Error("ZQ-EXC-7719 postgres://user:pw@host");
    const outcome = await handleChatMessage("add ETF XYZ", () => {
      throw sentinel;
    });
    expect(outcome).toEqual({ kind: "error" });
    expect(JSON.stringify(outcome)).not.toContain("ZQ-EXC");
    expect(JSON.stringify(outcome)).not.toContain("postgres://");
  });

  it("CE-4: a rejecting loadSettings gives a bare error", async () => {
    const fake = createFakeProvider("gemini");
    const deps = makeDeps(fake, { loadSettings: () => Promise.reject(new Error("ZQ-EXC-boom")) });
    const outcome = await handleChatMessage("add ETF XYZ", deps);
    expect(outcome).toEqual({ kind: "error" });
  });

  it("CE-6: a rejecting loadConfigurationContext gives a bare error and makes no generate call", async () => {
    vi.mocked(loadConfigurationContext).mockRejectedValueOnce(new Error("ZQ-EXC-ctx"));
    const fake = createFakeProvider("gemini");
    const outcome = await handleChatMessage("add ETF XYZ", makeDeps(fake));
    expect(outcome).toEqual({ kind: "error" });
    expect(fake.calls).toHaveLength(0);
  });

  it("CE-7: a rejecting write stops the list and gives a fixed failed status", async () => {
    vi.mocked(executeConfigurationIntent).mockRejectedValueOnce(new Error("ZQ-EXC-exec"));
    const fake = createFakeProvider("gemini", [{ ok: true, text: configurationOutput("add_etf", { symbol: "XYZ", name: null }) }]);
    const outcome = await handleChatMessage("add ETF XYZ", makeDeps(fake));
    expect(outcome).toMatchObject({
      kind: "executed_actions",
      results: [{ status: "failed", capability: "configuration", symbol: "XYZ" }],
    });
  });

  it("CE-8: sentinel text in the model's JSON never reaches the outcome", async () => {
    const fake = createFakeProvider("gemini", [
      { ok: true, text: '{"actions":[{"capability":"configuration","action":"add_etf","symbol":"XYZ","name":"ZQ-SENTINEL-5531","note":"ZQ-SENTINEL-5531"}]}' },
    ]);
    const outcome = await handleChatMessage("add ETF XYZ", makeDeps(fake));
    expect(JSON.stringify(outcome)).not.toContain("ZQ-SENTINEL");
  });
});

describe("CHAT_MESSAGE_MAX_LENGTH", () => {
  it("is 500 (sprint decision 13)", () => {
    expect(CHAT_MESSAGE_MAX_LENGTH).toBe(500);
  });
});
