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
vi.mock("./capabilities/widgets/context", async (importOriginal) => ({
  withWidgets: (await importOriginal<typeof import("./capabilities/widgets/context")>()).withWidgets,
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
import { CHAT_MESSAGE_MAX_LENGTH, CHAT_UNAVAILABLE_REASONS, confirmChatPlan, getChatAvailability, handleChatMessage } from "./chat";

/** US-058: confirms a `proposed` outcome's token through `confirmChatPlan`, with the same fake plan key. */
async function confirm(outcome: { kind: string; token?: string }, depsFactory: () => ChatDeps) {
  if (outcome.kind !== "proposed" || outcome.token === undefined) {
    throw new Error("expected a proposed outcome with a token");
  }
  return confirmChatPlan(outcome.token, depsFactory);
}

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

const FAKE_PLAN_KEY = new Uint8Array(32).fill(7);

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
    planKey: () => FAKE_PLAN_KEY,
  });
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
    for (const raw of ["", "   \n\t", "a".repeat(2001), `  ${"a".repeat(2001)}  `]) {
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
      // US-058: the legacy `{"action":"unsupported"}` shape is not a valid envelope, so it
      // triggers one correction call (DEC-027 §3); the fake repeats the same text, so the
      // outcome is unchanged.
      const fake = createFakeProvider("gemini", [{ ok: true, text: '{"action":"unsupported"}' }]);
      await handleChatMessage("track net_asset for BTBETRETF", makeDeps(fake));
      expect(fake.calls).toHaveLength(2);
    });
  });

  it("CE-2: exactly 2000 characters (trimmed) is accepted", async () => {
    // US-058: same reason as above — the legacy shape is an invalid envelope, so one
    // correction call is made.
    const fake = createFakeProvider("gemini", [{ ok: true, text: '{"action":"unsupported"}' }]);
    const outcome = await handleChatMessage("a".repeat(2000), makeDeps(fake));
    expect(outcome.kind).not.toBe("invalid_message");
    expect(fake.calls).toHaveLength(2);
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
    const depsFactory = makeDeps(fake);
    const proposal = await handleChatMessage(
      "add a custom value and stop monitoring BTBETRETF",
      depsFactory,
    );
    expect(proposal.kind).toBe("proposed");
    const outcome = await confirm(proposal, depsFactory);
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
      const depsFactory = makeDeps(fake);
      const proposal = await handleChatMessage("track VUAN, add a custom value, and stop monitoring BTBETRETF", depsFactory);
      expect(proposal.kind).toBe("proposed");
      const outcome = await confirm(proposal, depsFactory);
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
      const depsFactory = makeDeps(fake);
      const proposal = await handleChatMessage("untrack VUAN twice and remove BTBETRETF", depsFactory);
      expect(proposal.kind).toBe("proposed");
      const outcome = await confirm(proposal, depsFactory);
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
      const depsFactory = makeDeps(fake);
      const proposal = await handleChatMessage("remove BTBETRETF", depsFactory);
      expect(proposal.kind).toBe("proposed");
      expect(await confirm(proposal, depsFactory)).toMatchObject({
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
    // US-058/DEC-027: "unsupported_format" is a model-call-layer-only reason (the downgrade
    // retry already failed); the user never sees that code, only "provider_error".
    const expectedError = code === "unsupported_format" ? "provider_error" : code;
    expect(outcome).toEqual({ kind: "interpreted", outcome: { kind: "provider_error", error: expectedError } });
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
  it("is 2000 (US-055 requirement 7, sprint-13 PO review)", () => {
    expect(CHAT_MESSAGE_MAX_LENGTH).toBe(2000);
  });
});

describe("executeActions returned/thrown widget failures (CE-G, US-051 C1/C2)", () => {
  it("CE-G1: a returned widget failure stops the list with exact done/failed/not_run results", async () => {
    const actions = [
      { capability: "configuration", action: "remove_etf", symbol: "BTBETRETF" },
      { capability: "widgets", action: "widget_add", etf: "BTBETRETF", definition: { operation: "change", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7 } },
      { capability: "configuration", action: "remove_etf", symbol: "BTBETRETF" },
    ];
    vi.mocked(executeWidgetIntent).mockResolvedValueOnce({ ok: false });
    const fake = createFakeProvider("gemini", [{ ok: true, text: actionListOutput(...actions) }]);
    const depsFactory = makeDeps(fake);
    const proposal = await handleChatMessage("remove BTBETRETF and add a widget and remove BTBETRETF", depsFactory);
    expect(proposal.kind).toBe("proposed");
    const outcome = await confirm(proposal, depsFactory);
    expect(outcome).toEqual({
      kind: "executed_actions",
      results: [
        {
          index: 1, status: "done", capability: "configuration", action: "remove_etf", symbol: "BTBETRETF",
          changed: true,
          configuration: { code: "added", symbol: "XYZ", field: null, adapterKey: null, detectionReason: null, changed: true },
        },
        {
          index: 2, status: "failed", capability: "widgets", action: "widget_add", symbol: "BTBETRETF", changed: false,
          detail: {
            operation: "change", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7,
            field: { fieldKey: "nav_per_unit", labelRo: "Valoare unitară a activului net (VUAN)", labelEn: "Net asset value per unit" },
          },
        },
        { index: 3, status: "not_run", capability: "configuration", action: "remove_etf", symbol: "BTBETRETF", changed: false },
      ],
    });
  });

  it("CE-G2: a rejecting executeConfigurationIntent stops the list before any widget execute call", async () => {
    const actions = [
      { capability: "configuration", action: "remove_etf", symbol: "BTBETRETF" },
      { capability: "widgets", action: "widget_add", etf: "BTBETRETF", definition: { operation: "change", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7 } },
      { capability: "configuration", action: "remove_etf", symbol: "BTBETRETF" },
    ];
    vi.mocked(executeConfigurationIntent).mockRejectedValueOnce(new Error("boom"));
    const fake = createFakeProvider("gemini", [{ ok: true, text: actionListOutput(...actions) }]);
    const depsFactory = makeDeps(fake);
    const proposal = await handleChatMessage("remove BTBETRETF and add a widget and remove BTBETRETF", depsFactory);
    expect(proposal.kind).toBe("proposed");
    const outcome = await confirm(proposal, depsFactory);
    expect(outcome).toEqual({
      kind: "executed_actions",
      results: [
        { index: 1, status: "failed", capability: "configuration", action: "remove_etf", symbol: "BTBETRETF", changed: false },
        {
          index: 2, status: "not_run", capability: "widgets", action: "widget_add", symbol: "BTBETRETF", changed: false,
          detail: {
            operation: "change", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7,
            field: { fieldKey: "nav_per_unit", labelRo: "Valoare unitară a activului net (VUAN)", labelEn: "Net asset value per unit" },
          },
        },
        { index: 3, status: "not_run", capability: "configuration", action: "remove_etf", symbol: "BTBETRETF", changed: false },
      ],
    });
    expect(executeWidgetIntent).not.toHaveBeenCalled();
  });
});

describe("validateAction registry lookup (CE-V, US-051 C3)", () => {
  it("CE-V1: a single registry lookup rejects unknown widget/configuration actions and prototype keys", async () => {
    const cases: Array<[unknown, string]> = [
      [{ capability: "widgets", action: "widget_delete", etf: "BTBETRETF" }, "unknown_operation"],
      [{ capability: "configuration", action: "set_cron_hour", symbol: "BTBETRETF" }, "unsupported"],
      [{ capability: "toString", action: "add_etf", symbol: "BTBETRETF" }, "unsupported"],
      [{ capability: "cron", action: "add_etf", symbol: "BTBETRETF" }, "unsupported"],
      [{ capability: "configuration", action: "ADD_ETF", symbol: "BTBETRETF" }, "unsupported"],
    ];
    for (const [action, reason] of cases) {
      const fake = createFakeProvider("gemini", [{ ok: true, text: actionListOutput(action) }]);
      const outcome = await handleChatMessage("do something", makeDeps(fake));
      expect(outcome).toEqual({ kind: "invalid_action", index: 1, reason });
      expect(executeConfigurationIntent).not.toHaveBeenCalled();
      expect(executeWidgetIntent).not.toHaveBeenCalled();
    }
  });
});

describe("widget read failure is isolated (CE-W, DEC-025 §1 / AC2)", () => {
  it("CE-W1: a configuration-only message does not fail when the widget read fails, even though it is now always read", async () => {
    vi.mocked(loadWidgetContext).mockRejectedValueOnce(new Error("widget context unavailable"));
    const fake = createFakeProvider("gemini", [{ ok: true, text: configurationOutput("track_field", { symbol: "BTBETRETF", field: "net_asset" }) }]);
    const outcome = await handleChatMessage("track net asset for BTBETRETF", makeDeps(fake));
    expect(outcome).toMatchObject({ kind: "executed_actions", results: [{ status: "done" }] });
    expect(loadWidgetContext).toHaveBeenCalledTimes(1);
  });

  it("CE-W2: a list containing a widget action still fails when the widget read fails", async () => {
    vi.mocked(loadWidgetContext).mockRejectedValueOnce(new Error("widget context unavailable"));
    const actions = [
      { capability: "configuration", action: "remove_etf", symbol: "BTBETRETF" },
      { capability: "widgets", action: "widget_add", etf: "BTBETRETF", definition: { operation: "change", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7 } },
    ];
    const fake = createFakeProvider("gemini", [{ ok: true, text: actionListOutput(...actions) }]);
    const outcome = await handleChatMessage("remove BTBETRETF and add a widget", makeDeps(fake));
    expect(outcome).toEqual({ kind: "error" });
    expect(executeConfigurationIntent).not.toHaveBeenCalled();
  });

  it("CE-W3: a failed widget read logs exactly one safe chat line and never leaks the exception text", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(loadWidgetContext).mockRejectedValueOnce(new Error("ZQ-EXC-widget postgres://user:pw@host"));
    const fake = createFakeProvider("gemini", [{ ok: true, text: configurationOutput("track_field", { symbol: "BTBETRETF", field: "net_asset" }) }]);
    const outcome = await handleChatMessage("track net asset for BTBETRETF", makeDeps(fake));
    const lines = spy.mock.calls.filter((c) => typeof c[0] === "string" && c[0].startsWith("[load-error]"));
    spy.mockRestore();

    expect(outcome).toMatchObject({ kind: "executed_actions", results: [{ status: "done" }] });
    expect(lines).toHaveLength(1);
    expect(lines[0][0]).toMatch(/^\[load-error\] chat /);
    expect(lines[0][0]).not.toContain("ZQ-EXC");
    expect(lines[0][0]).not.toContain("postgres://");
    expect(fake.calls[0]?.request.system).toContain('"widgets":[]');
  });
});

describe("the widgets state reaches the prompt (CE-P, AC2)", () => {
  it("CE-P1: the system prompt contains a resolved widget's fields", async () => {
    vi.mocked(loadWidgetContext).mockResolvedValueOnce({
      etfs: [{
        symbol: "BTBETRETF",
        available: buildTestContext().etfs[0]!.available,
        widgets: [{
          id: 1, etfId: 1, slot: 1, operation: "max", fieldKey: "nav_per_unit",
          periodUnit: "days", periodAmount: 30, updatedAt: new Date("2026-01-01"),
        }],
      }],
    });
    const fake = createFakeProvider("gemini", [{ ok: true, text: '{"kind":"unsupported"}' }]);
    await handleChatMessage("what custom values do I have", makeDeps(fake));
    const system = fake.calls[0]?.request.system ?? "";
    const open = system.indexOf("<catalogue_data>") + "<catalogue_data>".length;
    const close = system.indexOf("</catalogue_data>");
    const dataBlock = system.slice(open, close);
    expect(dataBlock).toContain('"operation":"max"');
    expect(dataBlock).toContain('"fieldKey":"nav_per_unit"');
    expect(dataBlock).toContain('"periodAmount":30');
  });
});

describe("tolerant normalisation runs before target resolution and validation (CE-N, US-054 AC2)", () => {
  it("CE-N1: a sloppy widget action using symbol instead of etf is normalised then executed with the canonical shape", async () => {
    const actions = [{
      capability: "widgets", action: "widget_add", symbol: "BTBETRETF",
      definition: { operation: "Maximum", fieldKey: "Net asset value per unit", periodUnit: "Days", periodAmount: "30" },
    }];
    const fake = createFakeProvider("gemini", [{ ok: true, text: actionListOutput(...actions) }]);
    const outcome = await handleChatMessage("set a max custom value", makeDeps(fake));
    expect(outcome).toMatchObject({ kind: "executed_actions" });
    expect(executeWidgetIntent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(executeWidgetIntent).mock.calls[0]?.[0]).toEqual({
      action: "widget_add", symbol: "BTBETRETF",
      definition: { operation: "max", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 30 },
    });
  });

  it("CE-N2: the symbol->etf rename runs before * expansion; NOADPETF's empty catalogue still fails honestly", async () => {
    const context = buildTestContext();
    vi.mocked(loadWidgetContext).mockResolvedValueOnce({
      etfs: context.etfs.map((e) => ({ symbol: e.symbol, available: e.available, widgets: [] })),
    });
    const actions = [{
      capability: "widgets", action: "widget_add", symbol: "*",
      definition: { operation: "change", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7 },
    }];
    const fake = createFakeProvider("gemini", [{ ok: true, text: actionListOutput(...actions) }]);
    const outcome = await handleChatMessage("add a custom value for all etf", makeDeps(fake));
    expect(outcome).toEqual({ kind: "invalid_action", index: 1, reason: "unknown_field", symbol: "NOADPETF" });
  });

  it("CE-N3: a configuration action using etf and a RO label is normalised to symbol/field before execution", async () => {
    const actions = [{ capability: "configuration", action: "track_field", etf: "BTBETRETF", field: "Activ net" }];
    const fake = createFakeProvider("gemini", [{ ok: true, text: actionListOutput(...actions) }]);
    const outcome = await handleChatMessage("urmărește activul net", makeDeps(fake));
    expect(outcome).toMatchObject({ kind: "executed_actions" });
    expect(executeConfigurationIntent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(executeConfigurationIntent).mock.calls[0]?.[0]).toEqual({
      action: "track_field", symbol: "BTBETRETF", field: "net_asset",
    });
  });
});

describe("* expansion and the action cap (CE-A, AC3/AC6/AC7)", () => {
  const manyActive = {
    etfs: Array.from({ length: 8 }, (_, i) => ({
      symbol: `ETF${i}`,
      name: `ETF ${i}`,
      isActive: true,
      available: buildTestContext().etfs[0]!.available,
      tracked: [],
    })).concat([{ symbol: "OLDETF", name: "Old", isActive: false, available: [], tracked: [] }]),
  };

  it("CE-A1: widget_add etf:* expands to every active ETF, never the inactive one", async () => {
    vi.mocked(loadConfigurationContext).mockResolvedValueOnce(manyActive);
    vi.mocked(loadWidgetContext).mockResolvedValueOnce({
      etfs: manyActive.etfs.filter((e) => e.isActive).map((e) => ({ symbol: e.symbol, available: e.available, widgets: [] })),
    });
    const actions = [{
      capability: "widgets", action: "widget_add", etf: "*",
      definition: { operation: "change", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7 },
    }];
    const fake = createFakeProvider("gemini", [{ ok: true, text: actionListOutput(...actions) }]);
    const outcome = await handleChatMessage("add a custom value for all etf", makeDeps(fake));
    if (outcome.kind !== "executed_actions") throw new Error(`unexpected kind ${outcome.kind}`);
    expect(outcome.results).toHaveLength(8);
    expect(outcome.results.every((r) => r.index === 1)).toBe(true);
    expect(executeWidgetIntent).toHaveBeenCalledTimes(8);
    const calledSymbols = vi.mocked(executeWidgetIntent).mock.calls.map(([intent]) => intent.symbol);
    expect(calledSymbols).toEqual(manyActive.etfs.filter((e) => e.isActive).map((e) => e.symbol));
    expect(calledSymbols).not.toContain("OLDETF");
  });

  it("CE-A2: add_etf/remove_etf with symbol:* is invalid_action all_not_allowed, no execute call", async () => {
    for (const actions of [
      [{ capability: "configuration", action: "add_etf", symbol: "*", name: null }],
      [{ capability: "configuration", action: "remove_etf", symbol: "*" }],
    ]) {
      const fake = createFakeProvider("gemini", [{ ok: true, text: actionListOutput(...actions) }]);
      const outcome = await handleChatMessage("remove every etf", makeDeps(fake));
      expect(outcome).toEqual({ kind: "invalid_action", index: 1, reason: "all_not_allowed" });
      expect(executeConfigurationIntent).not.toHaveBeenCalled();
    }
  });

  it("CE-A3: a 5-action list with one * action over 3 ETFs is accepted (the cap counts model actions)", async () => {
    const threeUniform = {
      etfs: ["BTBETRETF", "TVBETETF", "PTENGETF"].map((symbol) => ({
        symbol, name: symbol, isActive: true, available: buildTestContext().etfs[0]!.available, tracked: [],
      })),
    };
    vi.mocked(loadConfigurationContext).mockResolvedValueOnce(threeUniform);
    vi.mocked(loadWidgetContext).mockResolvedValueOnce({
      etfs: threeUniform.etfs.map((e) => ({ symbol: e.symbol, available: e.available, widgets: [] })),
    });
    const widget = {
      capability: "widgets", action: "widget_add", etf: "*",
      definition: { operation: "change", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7 },
    };
    const track = { capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "net_asset" };
    const actions = [widget, track, track, track, track];
    const fake = createFakeProvider("gemini", [{ ok: true, text: actionListOutput(...actions) }]);
    const outcome = await handleChatMessage("add a custom value for all etf and track things", makeDeps(fake));
    if (outcome.kind !== "executed_actions") throw new Error(`unexpected kind ${outcome.kind}`);
    expect(outcome.results).toHaveLength(7);
  });

  it("CE-A4: validate-all-first — an invalid * action at position 2 stops everything, no execute call at all", async () => {
    vi.mocked(loadConfigurationContext).mockResolvedValueOnce(buildTestContext());
    vi.mocked(loadWidgetContext).mockResolvedValueOnce({
      etfs: buildTestContext().etfs.map((e) => ({ symbol: e.symbol, available: e.available, widgets: [] })),
    });
    const valid = {
      capability: "widgets", action: "widget_add", etf: "BTBETRETF",
      definition: { operation: "change", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7 },
    };
    const badAll = {
      capability: "widgets", action: "widget_add", etf: "*",
      definition: { operation: "change", fieldKey: "net_asset", periodUnit: "days", periodAmount: 7 },
    };
    const actions = [valid, badAll];
    const fake = createFakeProvider("gemini", [{ ok: true, text: actionListOutput(...actions) }]);
    const outcome = await handleChatMessage("add two custom values", makeDeps(fake));
    expect(outcome).toEqual({ kind: "invalid_action", index: 2, reason: "unknown_field", symbol: "NOADPETF" });
    expect(executeWidgetIntent).not.toHaveBeenCalled();
    expect(executeConfigurationIntent).not.toHaveBeenCalled();
  });

  function threeUniformContext() {
    return {
      etfs: ["BTBETRETF", "TVBETETF", "PTENGETF"].map((symbol) => ({
        symbol, name: symbol, isActive: true, available: buildTestContext().etfs[0]!.available, tracked: [],
      })),
    };
  }

  it("CE-A5: a * widget action then a configuration action executes in order: 3 widget calls then 1 configuration call", async () => {
    const context = threeUniformContext();
    vi.mocked(loadConfigurationContext).mockResolvedValueOnce(context);
    vi.mocked(loadWidgetContext).mockResolvedValueOnce({
      etfs: context.etfs.map((e) => ({ symbol: e.symbol, available: e.available, widgets: [] })),
    });
    const widgetAll = {
      capability: "widgets", action: "widget_add", etf: "*",
      definition: { operation: "change", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7 },
    };
    const track = { capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "net_asset" };
    const actions = [widgetAll, track];
    const fake = createFakeProvider("gemini", [{ ok: true, text: actionListOutput(...actions) }]);
    const outcome = await handleChatMessage("add a custom value for all etf then track net asset", makeDeps(fake));
    if (outcome.kind !== "executed_actions") throw new Error(`unexpected kind ${outcome.kind}`);
    expect(outcome.results.map((r) => r.capability)).toEqual(["widgets", "widgets", "widgets", "configuration"]);
    expect(vi.mocked(executeWidgetIntent).mock.invocationCallOrder.every(
      (order) => order < vi.mocked(executeConfigurationIntent).mock.invocationCallOrder[0]!,
    )).toBe(true);
  });

  it("CE-A6: a runtime failure on the 2nd expanded target stops the rest and the next model action", async () => {
    const context = threeUniformContext();
    vi.mocked(loadConfigurationContext).mockResolvedValueOnce(context);
    vi.mocked(loadWidgetContext).mockResolvedValueOnce({
      etfs: context.etfs.map((e) => ({ symbol: e.symbol, available: e.available, widgets: [] })),
    });
    vi.mocked(executeWidgetIntent)
      .mockResolvedValueOnce({ ok: true, outcome: { action: "widget_add", symbol: "BTBETRETF", changed: true, slot: 1 } })
      .mockResolvedValueOnce({ ok: false });
    const widgetAll = {
      capability: "widgets", action: "widget_add", etf: "*",
      definition: { operation: "change", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7 },
    };
    const track = { capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "net_asset" };
    const actions = [widgetAll, track];
    const fake = createFakeProvider("gemini", [{ ok: true, text: actionListOutput(...actions) }]);
    const outcome = await handleChatMessage("add a custom value for all etf then track net asset", makeDeps(fake));
    if (outcome.kind !== "executed_actions") throw new Error(`unexpected kind ${outcome.kind}`);
    expect(outcome.results.map((r) => r.status)).toEqual(["done", "failed", "not_run", "not_run"]);
    expect(executeConfigurationIntent).not.toHaveBeenCalled();
  });
});
