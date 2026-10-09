import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import { seed } from "../db/seed";
import { createFakeProvider } from "../../test/helpers/ai-fakes";
import { createProviderRegistry } from "./providers/registry";
import { confirmChatPlan, handleChatMessage, type ChatActionResult, type ChatDeps, type ChatOutcome } from "./chat";
import { HISTORY_MESSAGES } from "./chat-history";
import type { ProviderDeps } from "./provider-deps";
import { buildChatReply } from "../../app/chat/reply-messages";
import { chatTurn } from "../../components/chat/transcript";
import type { ChatReplyState, TranscriptEntry, WhatDescription } from "../../components/chat/chat-state";

type ActionResultExpectation = Pick<ChatActionResult, "action" | "symbol" | "status">;
type ReplyLineExpectation = {
  status: string;
  messageKey: string;
  symbol: string | null;
  what: Record<string, unknown> | null;
};
type ReplyStateExpectation = {
  messageKey: string;
  modelText: string | null;
  warning: boolean;
  lines: readonly ReplyLineExpectation[];
  reason: { key: string; symbol: string | null; field: { ro: string; en: string } | null } | null;
  planStatus: string | null;
};
type Expectation = {
  kind: ChatOutcome["kind"];
  anyChanged?: boolean;
  warning?: boolean;
  providerCalls?: number;
  actionResults: readonly ActionResultExpectation[];
  replyState: ReplyStateExpectation;
  proposal?: { actionResults: readonly ActionResultExpectation[]; replyState: ReplyStateExpectation };
  correction?: { reasonLine: string; forbiddenValue: string };
};
type Turn = { user: string; model: string | null; correctionModel?: string; confirm?: "button" | "typed"; expect: Expectation };
type Dialogue = { id: string; lang: "ro" | "en"; transcript: boolean; title: string; turns: readonly Turn[] };

const DIALOGUES: readonly Dialogue[] = JSON.parse(
  readFileSync(path.join(__dirname, "../../test/fixtures/ai/chat-conversations.json"), "utf8"),
);
const PLAN_KEY = new Uint8Array(32).fill(7);

const TRANSCRIPT_PHRASES = [
  "clear units in circulation for all etf",
  "add max value for units in circulation for last 7 days",
  "clear max value for units in circulation for last month for all etf",
  "clear min value for units in circulation for last 7 days for all etf",
  "add max value for units in circulation for last 30 days for all etf",
] as const;

describe("AC8 self-checks (the fixture itself, not the conversations)", () => {
  it("has at least 10 dialogues, at least 4 Romanian and 4 English", () => {
    expect(DIALOGUES.length).toBeGreaterThanOrEqual(10);
    expect(DIALOGUES.filter((d) => d.lang === "ro").length).toBeGreaterThanOrEqual(4);
    expect(DIALOGUES.filter((d) => d.lang === "en").length).toBeGreaterThanOrEqual(4);
  });

  it("has exactly one transcript dialogue, containing the 5 phrases in order", () => {
    const transcripts = DIALOGUES.filter((d) => d.transcript);
    expect(transcripts).toHaveLength(1);
    expect(transcripts[0]!.turns.map((t) => t.user)).toEqual(TRANSCRIPT_PHRASES);
  });

  it("every dialogue has at least one turn", () => {
    for (const d of DIALOGUES) expect(d.turns.length).toBeGreaterThan(0);
  });

  it("pins raw results and reply-state expectations for every turn", () => {
    for (const dialogue of DIALOGUES) {
      for (const turn of dialogue.turns) {
        expect(turn.expect.actionResults, `${dialogue.id}: ${turn.user}`).toBeDefined();
        expect(turn.expect.replyState, `${dialogue.id}: ${turn.user}`).toBeDefined();
        expect(turn.expect.replyState.warning, `${dialogue.id}: ${turn.user}`).toEqual(expect.any(Boolean));
        expect(turn.expect.replyState.lines, `${dialogue.id}: ${turn.user}`).toBeDefined();
        if (turn.confirm !== undefined) {
          expect(turn.expect.proposal, `${dialogue.id}: ${turn.user}`).toBeDefined();
        }
        if (turn.correctionModel !== undefined) {
          expect(turn.expect.correction, `${dialogue.id}: ${turn.user}`).toBeDefined();
        }
      }
    }
  });
});

let db: EmptyTestDatabase;
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  fetchSpy = vi.fn(async () => {
    throw new Error("real network forbidden");
  });
  vi.stubGlobal("fetch", fetchSpy);
  db = await createEmptyTestDatabase();
  await seed(db.mockDb, db.runner);
}, 30_000);

afterEach(async () => {
  await db.close();
});

function depsFactory(fake: ReturnType<typeof createFakeProvider>): () => ChatDeps {
  const provider: ProviderDeps = {
    loadSettings: async () => ({ provider: "gemini", model: "m-1" }),
    loadStoredKeys: async () => new Map(),
    registry: createProviderRegistry([fake]),
    readApiKey: () => "k-test",
    fetch: fetchSpy,
  };
  const detect = vi.fn().mockResolvedValue({ adapterKey: null, reason: "no_match" });
  return () => ({
    provider,
    config: { db: db.mockDb, run: db.runner, registry: defaultAdapterRegistry, detect, now: () => new Date("2026-10-05T08:00:00Z") },
    widgets: { db: db.mockDb, run: db.runner, registry: defaultAdapterRegistry, now: () => new Date("2026-10-05T08:00:00Z") },
    planKey: () => PLAN_KEY,
  });
}

function projectWhat(what: WhatDescription | undefined): Record<string, unknown> | null {
  if (what === undefined) return null;
  const target = (value: NonNullable<WhatDescription["to"]>) => ({
    ...(value.operation === undefined ? {} : { operation: value.operation }),
    ...(value.fieldKey === undefined ? {} : { fieldKey: value.fieldKey }),
    ...(value.field === undefined ? {} : { field: value.field }),
    ...(value.periodUnit === undefined ? {} : { periodUnit: value.periodUnit }),
    ...(value.periodAmount === undefined ? {} : { periodAmount: value.periodAmount }),
  });
  return {
    ...(what.operation === undefined ? {} : { operation: what.operation }),
    ...(what.fieldKey === undefined ? {} : { fieldKey: what.fieldKey }),
    ...(what.field === undefined ? {} : { field: what.field }),
    ...(what.periodUnit === undefined ? {} : { periodUnit: what.periodUnit }),
    ...(what.periodAmount === undefined ? {} : { periodAmount: what.periodAmount }),
    ...(what.slot === undefined ? {} : { slot: what.slot }),
    ...(what.count === undefined ? {} : { count: what.count }),
    ...(what.to === undefined ? {} : { to: target(what.to) }),
  };
}

function projectReplyState(reply: ChatReplyState): ReplyStateExpectation {
  return {
    messageKey: reply.messageKey,
    modelText: reply.modelText ?? null,
    warning: reply.warning === true,
    lines: (reply.actions ?? []).map((line) => ({
      status: line.status,
      messageKey: line.messageKey,
      symbol: line.values?.symbol ?? null,
      what: projectWhat(line.what),
    })),
    reason: reply.reason === undefined
      ? null
      : {
          key: reply.reason.key,
          symbol: reply.reason.symbol ?? null,
          field: reply.reason.field ?? null,
        },
    planStatus: reply.plan?.status ?? null,
  };
}

function projectActionResults(outcome: ChatOutcome): ActionResultExpectation[] {
  if (outcome.kind !== "executed_actions" && outcome.kind !== "proposed") return [];
  return outcome.results.map(({ action, symbol, status }) => ({ action, symbol, status }));
}

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function runTurn(
  turn: Turn,
  transcript: readonly TranscriptEntry[],
  deps: () => ChatDeps,
  fake: ReturnType<typeof createFakeProvider>,
): Promise<{ transcript: TranscriptEntry[]; outcome: ChatOutcome }> {
  const sentOutcomes: ChatOutcome[] = [];
  const confirmedOutcomes: ChatOutcome[] = [];
  let proposedToken: string | undefined;

  const send = async (data: FormData): Promise<ChatReplyState> => {
    const outcome = await handleChatMessage(
      String(data.get("message") ?? ""),
      deps,
      { history: String(data.get("history") ?? "[]") },
    );
    sentOutcomes.push(outcome);
    return buildChatReply(outcome);
  };
  const confirm = {
    action: async (data: FormData): Promise<ChatReplyState> => {
      const keys: string[] = [];
      data.forEach((_value, key) => keys.push(key));
      expect(keys).toEqual(["token"]);
      expect(data.get("token")).toBe(proposedToken);
      const outcome = await confirmChatPlan(String(data.get("token")), deps, {
        now: () => Date.parse("2026-10-05T08:00:00Z"),
      });
      confirmedOutcomes.push(outcome);
      return buildChatReply(outcome);
    },
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
  };

  const callsBefore = fake.calls.length;
  let next = await chatTurn(
    transcript,
    formData({ message: turn.user }),
    send,
    "[key request]",
    HISTORY_MESSAGES,
    confirm,
  );
  const initialOutcome = sentOutcomes[0]!;

  if (turn.expect.proposal !== undefined) {
    expect(initialOutcome.kind).toBe("proposed");
    expect(projectActionResults(initialOutcome)).toEqual(turn.expect.proposal.actionResults);
    expect(projectReplyState(next.at(-1)!.reply)).toEqual(turn.expect.proposal.replyState);
  }

  if (turn.confirm !== undefined) {
    expect(initialOutcome.kind).toBe("proposed");
    if (initialOutcome.kind !== "proposed") throw new Error("Expected a confirmation proposal");
    proposedToken = initialOutcome.token;
    const confirmData = turn.confirm === "button"
      ? formData({ intent: "confirm" })
      : formData({ message: "yes" });
    next = await chatTurn(next, confirmData, send, "[key request]", HISTORY_MESSAGES, confirm);
    expect(confirmedOutcomes).toHaveLength(1);
    expect(next.at(-2)?.reply.plan).toEqual({ status: "confirmed" });
    expect(next.at(-2)?.reply.plan?.token).toBeUndefined();
  } else {
    expect(initialOutcome.kind).not.toBe("proposed");
    expect(confirmedOutcomes).toHaveLength(0);
  }

  const outcome = turn.confirm === undefined ? initialOutcome : confirmedOutcomes[0]!;
  expect(outcome.kind).toBe(turn.expect.kind);
  expect(projectActionResults(outcome)).toEqual(turn.expect.actionResults);
  expect(projectReplyState(next.at(-1)!.reply)).toEqual(turn.expect.replyState);

  if (turn.expect.anyChanged !== undefined && outcome.kind === "executed_actions") {
    expect(outcome.results.some((result) => result.changed)).toBe(turn.expect.anyChanged);
  }
  if (turn.expect.warning !== undefined) {
    expect(next.at(-1)!.reply.warning === true).toBe(turn.expect.warning);
  }
  const expectedCalls = turn.expect.providerCalls ?? (turn.model === null ? 0 : turn.correctionModel === undefined ? 1 : 2);
  expect(fake.calls).toHaveLength(callsBefore + expectedCalls);

  if (turn.expect.correction !== undefined) {
    expect(turn.correctionModel).toBeDefined();
    const request = fake.calls[callsBefore + 1]?.request;
    expect(request).toBeDefined();
    const correctionMessage = request!.messages?.at(-1)?.content ?? "";
    expect(correctionMessage).toContain(turn.expect.correction.reasonLine);
    expect(correctionMessage).not.toContain(turn.expect.correction.forbiddenValue);
  }
  if (turn.confirm !== undefined) {
    expect(fake.calls).toHaveLength(callsBefore + expectedCalls);
  }

  return { transcript: next, outcome };
}

async function widgetSlots(symbol: string): Promise<number[]> {
  const rows = (
    await db.pg.query(
      `select "slot" from "etf_widgets" where "etf_id" = (select "id" from "etfs" where "symbol" = $1) order by "slot"`,
      [symbol],
    )
  ).rows as { slot: number }[];
  return rows.map((r) => r.slot);
}

describe.each(DIALOGUES)("conversation $id ($lang): $title", (dialogue) => {
  it("runs every turn through handleChatMessage with the growing visible history, per the plan's AC2/AC3/AC8", async () => {
    const steps = dialogue.turns.flatMap((turn) => {
      if (turn.model === null) return [];
      const answer = { ok: true as const, text: turn.model };
      return [
        answer,
        ...(turn.correctionModel === undefined ? [] : [{ ok: true as const, text: turn.correctionModel }]),
      ];
    });
    const fake = createFakeProvider("gemini", steps.length > 0 ? steps : [{ ok: true, text: '{"reply":null,"actions":[]}' }]);
    const deps = depsFactory(fake);

    let transcript: TranscriptEntry[] = [];
    for (const turn of dialogue.turns) {
      const next = await runTurn(turn, transcript, deps, fake);
      transcript = next.transcript;
    }
  });
});

describe("D01 transcript: cumulative widget state matches the real conversation", () => {
  it("ends with a 30-day max on every ETF and no 7-day max except the one re-added", async () => {
    const d01 = DIALOGUES.find((d) => d.id === "D01")!;
    const steps = d01.turns.map((t) => ({ ok: true as const, text: t.model! }));
    const fake = createFakeProvider("gemini", steps);
    const deps = depsFactory(fake);

    let transcript: TranscriptEntry[] = [];
    for (const turn of d01.turns) {
      transcript = (await runTurn(turn, transcript, deps, fake)).transcript;
    }

    for (const symbol of ["BTBETRETF", "PTENGETF", "TVBETETF"]) {
      const slots = await widgetSlots(symbol);
      expect(slots.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("D06 manual script: a slot cleared on exactly one ETF", () => {
  it("leaves the 30-day max on every ETF but the 7-day max only where not cleared", async () => {
    const d06 = DIALOGUES.find((d) => d.id === "D06")!;
    const steps = d06.turns.map((t) => ({ ok: true as const, text: t.model! }));
    const fake = createFakeProvider("gemini", steps);
    const deps = depsFactory(fake);

    let transcript: TranscriptEntry[] = [];
    for (const turn of d06.turns) {
      transcript = (await runTurn(turn, transcript, deps, fake)).transcript;
    }

    expect((await widgetSlots("PTENGETF")).length).toBe(1); // only the 30-day max survives
    expect((await widgetSlots("BTBETRETF")).length).toBe(2); // both 7-day and 30-day max
    expect((await widgetSlots("TVBETETF")).length).toBe(2);
  });
});
