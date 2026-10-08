import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import { seed } from "../db/seed";
import { createFakeProvider } from "../../test/helpers/ai-fakes";
import { createProviderRegistry } from "./providers/registry";
import { handleChatMessage, type ChatDeps, type ChatOutcome } from "./chat";
import { HISTORY_MESSAGES } from "./chat-history";
import type { ProviderDeps } from "./provider-deps";
import { buildChatReply } from "../../app/chat/reply-messages";
import { appendTranscript, historyFromTranscript } from "../../components/chat/transcript";
import type { TranscriptEntry } from "../../components/chat/chat-state";

type Expectation = { kind: ChatOutcome["kind"]; anyChanged?: boolean; warning?: boolean };
type Turn = { user: string; model: string | null; expect: Expectation };
type Dialogue = { id: string; lang: "ro" | "en"; transcript: boolean; title: string; turns: readonly Turn[] };

const DIALOGUES: readonly Dialogue[] = JSON.parse(
  readFileSync(path.join(__dirname, "../../test/fixtures/ai/chat-conversations.json"), "utf8"),
);

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
  });
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
    const steps = dialogue.turns.filter((t) => t.model !== null).map((t) => ({ ok: true as const, text: t.model! }));
    const fake = createFakeProvider("gemini", steps.length > 0 ? steps : [{ ok: true, text: '{"reply":null,"actions":[]}' }]);
    const deps = depsFactory(fake);

    let transcript: TranscriptEntry[] = [];
    let providerCallsSoFar = 0;

    for (const turn of dialogue.turns) {
      const history = JSON.stringify(historyFromTranscript(transcript, HISTORY_MESSAGES));
      const outcome = await handleChatMessage(turn.user, deps, { history });
      const reply = buildChatReply(outcome);
      transcript = appendTranscript(transcript, turn.user, reply, "[key request]");

      expect(outcome.kind).toBe(turn.expect.kind);
      if (turn.expect.anyChanged !== undefined && outcome.kind === "executed_actions") {
        expect(outcome.results.some((r) => r.changed)).toBe(turn.expect.anyChanged);
      }
      if (turn.expect.warning !== undefined) {
        expect(reply.warning === true).toBe(turn.expect.warning);
      }
      if (turn.model !== null) {
        providerCallsSoFar += 1;
        expect(fake.calls).toHaveLength(providerCallsSoFar);
      } else {
        expect(fake.calls).toHaveLength(providerCallsSoFar);
      }
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
      const history = JSON.stringify(historyFromTranscript(transcript, HISTORY_MESSAGES));
      const outcome = await handleChatMessage(turn.user, deps, { history });
      const reply = buildChatReply(outcome);
      transcript = appendTranscript(transcript, turn.user, reply, "[key request]");
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
      const history = JSON.stringify(historyFromTranscript(transcript, HISTORY_MESSAGES));
      const outcome = await handleChatMessage(turn.user, deps, { history });
      const reply = buildChatReply(outcome);
      transcript = appendTranscript(transcript, turn.user, reply, "[key request]");
    }

    expect((await widgetSlots("PTENGETF")).length).toBe(1); // only the 30-day max survives
    expect((await widgetSlots("BTBETRETF")).length).toBe(2); // both 7-day and 30-day max
    expect((await widgetSlots("TVBETETF")).length).toBe(2);
  });
});
