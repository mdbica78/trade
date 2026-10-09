import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeProvider } from "../../test/helpers/ai-fakes";
import { seedFieldCatalog } from "../db/seed-data";
import { createProviderRegistry } from "./providers/registry";
import type { ProviderDeps } from "./provider-deps";
import type { ChatDeps, ChatOutcome } from "./chat";
import type { ConfigurationContext } from "./capabilities/configuration/context";
import type { Widget } from "../config/widgets";

function fieldsFor(adapterKey: string) {
  return seedFieldCatalog
    .filter((f) => f.adapterKey === adapterKey)
    .map((f) => ({ fieldKey: f.fieldKey, labelRo: f.labelRo, labelEn: f.labelEn }));
}

const BRD_FIELDS = fieldsFor("brd-depositary");
const ICB_FIELDS = fieldsFor("intercapital-nav");
const TRACKED = BRD_FIELDS.filter((f) => f.fieldKey === "units_in_circulation" || f.fieldKey === "nav_per_unit");

const REGRESSION_CONTEXT: ConfigurationContext = {
  etfs: [
    { symbol: "BTBETRETF", name: "BRD ETF 1", isActive: true, available: BRD_FIELDS, tracked: TRACKED },
    { symbol: "ICBETNETF", name: "InterCapital ETF", isActive: false, available: ICB_FIELDS, tracked: [] },
    { symbol: "PTENGETF", name: "BRD ETF 2", isActive: true, available: BRD_FIELDS, tracked: TRACKED },
    { symbol: "TVBETETF", name: "BRD ETF 3", isActive: true, available: BRD_FIELDS, tracked: TRACKED },
  ],
};

function fakeWidget(overrides: Partial<Widget> & Pick<Widget, "slot" | "operation" | "fieldKey" | "periodUnit" | "periodAmount">): Widget {
  return { id: overrides.slot, etfId: 1, updatedAt: new Date("2026-01-01"), ...overrides };
}

const REGRESSION_WIDGET_CONTEXT = {
  etfs: [
    {
      symbol: "BTBETRETF",
      available: BRD_FIELDS,
      widgets: [
        fakeWidget({ slot: 1, operation: "max", fieldKey: "units_in_circulation", periodUnit: "days", periodAmount: 30 }),
        fakeWidget({ slot: 2, operation: "min", fieldKey: "units_in_circulation", periodUnit: "days", periodAmount: 7 }),
      ],
    },
    { symbol: "ICBETNETF", available: ICB_FIELDS, widgets: [] },
    { symbol: "PTENGETF", available: BRD_FIELDS, widgets: [] },
    {
      symbol: "TVBETETF",
      available: BRD_FIELDS,
      widgets: [fakeWidget({ slot: 1, operation: "max", fieldKey: "units_in_circulation", periodUnit: "days", periodAmount: 30 })],
    },
  ],
};

vi.mock("./capabilities/configuration/context", () => ({
  loadConfigurationContext: vi.fn(async () => REGRESSION_CONTEXT),
}));
vi.mock("./capabilities/widgets/context", async (importOriginal) => ({
  withWidgets: (await importOriginal<typeof import("./capabilities/widgets/context")>()).withWidgets,
  loadWidgetContext: vi.fn(async () => REGRESSION_WIDGET_CONTEXT),
}));
vi.mock("./capabilities/configuration/execute", async (importOriginal) => ({
  configurationOutcomeFailed: (await importOriginal<typeof import("./capabilities/configuration/execute")>()).configurationOutcomeFailed,
  executeConfigurationIntent: vi.fn(async (intent: { symbol: string }) => ({
    code: "tracked", symbol: intent.symbol, field: null, adapterKey: null, detectionReason: null, changed: true,
  })),
}));
vi.mock("./capabilities/widgets/execute", () => ({
  executeWidgetIntent: vi.fn(async (intent: { action: string; symbol: string }) => ({
    ok: true, outcome: { action: intent.action, symbol: intent.symbol, changed: true, slot: null },
  })),
}));

import { executeConfigurationIntent } from "./capabilities/configuration/execute";
import { executeWidgetIntent } from "./capabilities/widgets/execute";
import { confirmChatPlan, handleChatMessage } from "./chat";
import { normaliseModelAction } from "./capabilities/normalise";
import { parseActionListOutput } from "./capabilities/action-list";

type RegressionRow = {
  id: string;
  lang: "ro" | "en";
  transcript: boolean;
  message: string;
  model: string;
  executed?: readonly { capability: "configuration" | "widgets"; intent: unknown }[];
  outcome?: ChatOutcome;
};

const PLAN_KEY = new Uint8Array(32).fill(7);

function needsCorrection(row: RegressionRow): boolean {
  return row.outcome?.kind === "invalid_action" ||
    (row.outcome?.kind === "interpreted" && row.outcome.outcome.kind === "unclear");
}

const ROWS: readonly RegressionRow[] = JSON.parse(
  readFileSync(path.join(__dirname, "../../test/fixtures/ai/chat-regression.json"), "utf8"),
);

const TRANSCRIPT_PHRASES = [
  "clear units in circulation for all etf",
  "add max value for units in circulation for last 7 days",
  "clear max value for units in circulation for last month for all etf",
  "clear min value for units in circulation for last 7 days for all etf",
  "add max value for units in circulation for last 30 days for all etf",
] as const;

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn(async () => {
    throw new Error("real network forbidden");
  });
  vi.stubGlobal("fetch", fetchSpy);
  vi.mocked(executeConfigurationIntent).mockClear();
  vi.mocked(executeWidgetIntent).mockClear();
});

function makeDeps(fake: ReturnType<typeof createFakeProvider>): () => ChatDeps {
  const provider: ProviderDeps = {
    loadSettings: async () => ({ provider: "gemini", model: "m-1" }),
    loadStoredKeys: async () => new Map(),
    registry: createProviderRegistry([fake]),
    readApiKey: () => "k-test",
    fetch: fetchSpy,
  };
  return () => ({
    provider,
    config: {} as ChatDeps["config"],
    widgets: {} as ChatDeps["widgets"],
    planKey: () => PLAN_KEY,
  });
}

function calledIntents(): { capability: "configuration" | "widgets"; intent: unknown; order: number }[] {
  const configCalls = vi.mocked(executeConfigurationIntent).mock.invocationCallOrder.map((order, i) => ({
    capability: "configuration" as const,
    intent: vi.mocked(executeConfigurationIntent).mock.calls[i]![0],
    order,
  }));
  const widgetCalls = vi.mocked(executeWidgetIntent).mock.invocationCallOrder.map((order, i) => ({
    capability: "widgets" as const,
    intent: vi.mocked(executeWidgetIntent).mock.calls[i]![0],
    order,
  }));
  return [...configCalls, ...widgetCalls].sort((a, b) => a.order - b.order);
}

describe("chat regression table (AC3, DEC-025 §6-§7)", () => {
  it("self-check: at least 25 rows, at least 8 ro and 8 en", () => {
    expect(ROWS.length).toBeGreaterThanOrEqual(25);
    expect(ROWS.filter((r) => r.lang === "ro").length).toBeGreaterThanOrEqual(8);
    expect(ROWS.filter((r) => r.lang === "en").length).toBeGreaterThanOrEqual(8);
  });

  it("self-check: every transcript phrase appears as a transcript:true row", () => {
    for (const phrase of TRANSCRIPT_PHRASES) {
      const row = ROWS.find((r) => r.message === phrase);
      expect(row, `no row for phrase "${phrase}"`).toBeDefined();
      expect(row?.transcript).toBe(true);
    }
  });

  it("self-check: at least 8 rows are sloppy (normalised or fenced)", () => {
    const sloppy = ROWS.filter((row) => {
      if (/```/.test(row.model)) return true;
      const parsed = parseActionListOutput(row.model);
      if (parsed.kind !== "actions") return false;
      return parsed.actions.some((action) => {
        const normalised = normaliseModelAction(action, REGRESSION_CONTEXT);
        return JSON.stringify(normalised) !== JSON.stringify(action);
      });
    });
    expect(sloppy.length).toBeGreaterThanOrEqual(8);
  });

  it("self-check: at least 4 rows are negative (invalid_action or interpreted)", () => {
    const negative = ROWS.filter((row) => row.outcome?.kind === "invalid_action" || row.outcome?.kind === "interpreted");
    expect(negative.length).toBeGreaterThanOrEqual(4);
  });

  for (const row of ROWS) {
    it(`${row.id} (${row.lang}${row.transcript ? ", transcript" : ""}): ${row.message}`, async () => {
      const steps = [{ ok: true as const, text: row.model }];
      if (needsCorrection(row)) steps.push({ ok: true as const, text: row.model });
      const fake = createFakeProvider("gemini", steps);
      const deps = makeDeps(fake);
      let outcome = await handleChatMessage(row.message, deps);

      if (outcome.kind === "proposed") {
        expect(executeConfigurationIntent).not.toHaveBeenCalled();
        expect(executeWidgetIntent).not.toHaveBeenCalled();
        outcome = await confirmChatPlan(outcome.token, deps);
      }

      expect(fake.calls).toHaveLength(needsCorrection(row) ? 2 : 1);
      expect(fake.calls[0]?.request.messages.at(-1)).toEqual({ role: "user", content: row.message.trim() });
      expect(fetchSpy).not.toHaveBeenCalled();

      if (row.outcome !== undefined) {
        expect(outcome).toEqual(row.outcome);
        expect(executeConfigurationIntent).not.toHaveBeenCalled();
        expect(executeWidgetIntent).not.toHaveBeenCalled();
        return;
      }

      expect(outcome.kind).toBe("executed_actions");
      const actual = calledIntents().map(({ capability, intent }) => ({ capability, intent }));
      expect(actual).toEqual(row.executed);
    });
  }
});
