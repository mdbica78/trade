import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeProvider } from "../../test/helpers/ai-fakes";
import { buildTestContext } from "../../test/helpers/ai-config-context";
import { createProviderRegistry } from "./providers/registry";
import { PROVIDER_ERROR_CODES } from "./providers/types";
import type { ProviderDeps } from "./provider-deps";
import type { ChatDeps } from "./chat";

vi.mock("./capabilities/configuration/context", () => ({
  loadConfigurationContext: vi.fn(async () => buildTestContext()),
}));
vi.mock("./capabilities/configuration/execute", () => ({
  executeConfigurationIntent: vi.fn(async () => ({
    code: "added",
    symbol: "XYZ",
    field: null,
    adapterKey: null,
    detectionReason: null,
    changed: true,
  })),
}));

import { loadConfigurationContext } from "./capabilities/configuration/context";
import { executeConfigurationIntent } from "./capabilities/configuration/execute";
import { CHAT_MESSAGE_MAX_LENGTH, CHAT_UNAVAILABLE_REASONS, handleChatMessage } from "./chat";

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn(async () => {
    throw new Error("real network forbidden");
  });
  vi.stubGlobal("fetch", fetchSpy);
  vi.mocked(loadConfigurationContext).mockClear();
  vi.mocked(executeConfigurationIntent).mockClear();
});

function makeDeps(fake: ReturnType<typeof createFakeProvider>, overrides: Partial<ProviderDeps> = {}): () => ChatDeps {
  const provider: ProviderDeps = {
    loadSettings: async () => ({ provider: "gemini", model: "m-1" }),
    registry: createProviderRegistry([fake]),
    readApiKey: () => "k-test",
    fetch: fetchSpy,
    ...overrides,
  };
  return () => ({ provider, config: {} as ChatDeps["config"] });
}

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

  it("CE-2: exactly 500 characters (trimmed) is accepted", async () => {
    const fake = createFakeProvider("gemini", [{ ok: true, text: '{"action":"unsupported"}' }]);
    const outcome = await handleChatMessage("a".repeat(500), makeDeps(fake));
    expect(outcome.kind).not.toBe("invalid_message");
    expect(fake.calls).toHaveLength(1);
  });

  it("CE-9: exactly one generate call and at most one execute call per message", async () => {
    const fake = createFakeProvider("gemini", [{ ok: true, text: '{"action":"add_etf","symbol":"XYZ","name":null}' }]);
    await handleChatMessage("add ETF XYZ", makeDeps(fake));
    expect(fake.calls).toHaveLength(1);
    expect(executeConfigurationIntent).toHaveBeenCalledTimes(1);
  });

  it("an unsupported/unclear/multiple outcome never calls execute", async () => {
    const fake = createFakeProvider("gemini", [{ ok: true, text: '{"action":"unsupported"}' }]);
    const outcome = await handleChatMessage("write me a poem", makeDeps(fake));
    expect(outcome.kind).toBe("interpreted");
    expect(executeConfigurationIntent).not.toHaveBeenCalled();
  });
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
    expect(outcome).toEqual({ kind: "interpreted", outcome: { kind: "provider_error", error: code }, field: null });
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

  it("CE-7: a rejecting executeConfigurationIntent gives a bare error", async () => {
    vi.mocked(executeConfigurationIntent).mockRejectedValueOnce(new Error("ZQ-EXC-exec"));
    const fake = createFakeProvider("gemini", [{ ok: true, text: '{"action":"add_etf","symbol":"XYZ","name":null}' }]);
    const outcome = await handleChatMessage("add ETF XYZ", makeDeps(fake));
    expect(outcome).toEqual({ kind: "error" });
  });

  it("CE-8: sentinel text in the model's JSON never reaches the outcome", async () => {
    const fake = createFakeProvider("gemini", [
      { ok: true, text: '{"action":"add_etf","symbol":"XYZ","name":"ZQ-SENTINEL-5531","note":"ZQ-SENTINEL-5531"}' },
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
