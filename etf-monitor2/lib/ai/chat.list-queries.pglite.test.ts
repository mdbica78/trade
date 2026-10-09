import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { createFakeProvider } from "../../test/helpers/ai-fakes";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import { seed } from "../db/seed";
import { addWidget } from "../config/widgets";
import { createProviderRegistry } from "./providers/registry";
import { handleChatMessage, type ChatDeps } from "./chat";
import type { ProviderDeps } from "./provider-deps";

type Row = { id: string; lang: "ro" | "en"; category: string; user: string; model: string; reply: string };
type State = {
  activeSymbols: string[];
  inactiveSymbols: string[];
  tracked: Record<string, string[]>;
  inactiveTracked: Record<string, string[]>;
  widgets: Record<string, unknown[]>;
  latestReport: Record<string, string | null>;
};
const FIXTURE = JSON.parse(
  readFileSync(path.join(__dirname, "../../test/fixtures/ai/chat-list-queries.json"), "utf8"),
) as { state: State; rows: Row[] };

const CATEGORIES = ["active_etfs", "inactive_etfs", "tracked_fields", "widgets", "latest_report_date"];
const NOW = new Date("2026-10-09T08:00:00Z");

let db: EmptyTestDatabase;
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  fetchSpy = vi.fn(async () => {
    throw new Error("real network forbidden");
  });
  vi.stubGlobal("fetch", fetchSpy);
  db = await createEmptyTestDatabase();
  await seed(db.mockDb, db.runner);
  await db.pg.query('update "etfs" set "is_active" = false where "symbol" = $1', ["PTENGETF"]);

  const id = async (symbol: string) =>
    (await db.pg.query<{ id: number }>('select "id" from "etfs" where "symbol" = $1', [symbol])).rows[0]!.id;
  const report = (etfId: number, date: string, status: string) =>
    db.pg.query('insert into "reports" ("etf_id", "report_date", "status") values ($1,$2,$3)', [etfId, date, status]);
  const btb = await id("BTBETRETF");
  await report(btb, "2026-10-02", "ok");
  await report(btb, "2026-10-07", "ok");
  await report(btb, "2026-10-08", "parse_error"); // newer but not successful: must not become the latest date
  await report(await id("TVBETETF"), "2026-10-06", "missing");
  await report(await id("PTENGETF"), "2026-09-30", "ok");

  await addWidget(
    { symbol: "BTBETRETF", definition: { operation: "max", fieldKey: "units_in_circulation", periodUnit: "days", periodAmount: 7 } },
    { db: db.mockDb, run: db.runner, registry: defaultAdapterRegistry, now: () => NOW },
  );
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
    config: { db: db.mockDb, run: db.runner, registry: defaultAdapterRegistry, detect, now: () => NOW },
    widgets: { db: db.mockDb, run: db.runner, registry: defaultAdapterRegistry, now: () => NOW },
    planKey: () => new Uint8Array(32).fill(7),
  });
}

type DataBlock = {
  etfs: { symbol: string; tracked: string[]; widgets: unknown[]; latest_report?: string | null }[];
  inactive_etfs: string[];
  inactive_state?: { symbol: string; tracked: string[]; widgets: unknown[]; latest_report: string | null }[];
};

function dataBlock(system: string): DataBlock {
  const open = system.indexOf("<catalogue_data>") + "<catalogue_data>".length;
  return JSON.parse(system.slice(open, system.indexOf("</catalogue_data>")).trim()) as DataBlock;
}

async function snapshot() {
  const tables = ["etfs", "tracked_fields", "etf_widgets", "reports", "report_values", "settings", "job_runs"];
  const out: Record<string, unknown[]> = {};
  for (const table of tables) {
    out[table] = (await db.pg.query(`select * from "${table}" order by 1`)).rows;
  }
  return out;
}

describe("US-059 list requests through a fake provider (LQ)", () => {
  it("LQ-0: the fixture covers every list category in both locales", () => {
    for (const category of CATEGORIES) {
      for (const lang of ["ro", "en"] as const) {
        expect(
          FIXTURE.rows.filter((r) => r.category === category && r.lang === lang).length,
          `${category}/${lang}`,
        ).toBeGreaterThanOrEqual(1);
      }
    }
    expect(new Set(FIXTURE.rows.map((r) => r.id)).size).toBe(FIXTURE.rows.length);
  });

  it("LQ-1: the context sent to the model carries exactly the state a list answer needs (active/inactive, tracked, widgets, latest ok report date)", async () => {
    const fake = createFakeProvider("gemini", [{ ok: true, text: FIXTURE.rows[0]!.model }]);
    await handleChatMessage(FIXTURE.rows[0]!.user, depsFactory(fake));
    const system = fake.calls[0]!.request.system;
    const data = dataBlock(system);

    expect(data.etfs.map((e) => e.symbol)).toEqual(FIXTURE.state.activeSymbols);
    expect(data.inactive_etfs).toEqual(FIXTURE.state.inactiveSymbols);
    for (const etf of data.etfs) {
      expect(etf.tracked, etf.symbol).toEqual(FIXTURE.state.tracked[etf.symbol]);
      expect(etf.widgets, etf.symbol).toEqual(FIXTURE.state.widgets[etf.symbol]);
      expect(etf.latest_report, etf.symbol).toBe(FIXTURE.state.latestReport[etf.symbol]);
    }
    expect(data.inactive_state).toEqual(
      FIXTURE.state.inactiveSymbols.map((symbol) => ({
        symbol,
        tracked: FIXTURE.state.inactiveTracked[symbol],
        widgets: [],
        latest_report: FIXTURE.state.latestReport[symbol],
      })),
    );
    // A newer non-ok report never leaks in, and neither do values, URLs, names or keys.
    const dataText = system.slice(system.indexOf("<catalogue_data>"));
    expect(dataText).not.toContain("2026-10-08");
    expect(dataText).not.toContain("2026-10-06");
    expect(system).not.toContain("https://bvb.ro");
    expect(system).not.toContain("k-test");
  });

  for (const row of FIXTURE.rows) {
    it(`LQ-2 ${row.id} (${row.lang}, ${row.category}): "${row.user}" -> the model's grounded answer, no action runs, nothing is written, no network`, async () => {
      const before = await snapshot();
      const fake = createFakeProvider("gemini", [{ ok: true, text: row.model }]);
      const outcome = await handleChatMessage(row.user, depsFactory(fake));

      expect(outcome).toEqual({ kind: "answered", reply: row.reply, question: null });
      expect(fake.calls).toHaveLength(1);
      expect(fake.calls[0]!.request.messages.at(-1)).toEqual({ role: "user", content: row.user });
      expect(await snapshot()).toEqual(before);
      expect(fetchSpy).not.toHaveBeenCalled();

      // Every symbol/date the canned answer states is really in the context data it was asked with.
      const system = fake.calls[0]!.request.system;
      const dataText = system.slice(system.indexOf("<catalogue_data>"));
      for (const token of row.reply.match(/\b[A-Z]{4,}ETF\b|\d{4}-\d{2}-\d{2}/g) ?? []) {
        expect(dataText, `${row.id}: ${token}`).toContain(token);
      }
    });
  }

  it("LQ-3: the prompt tells the model to answer list questions from the data, with no actions, and not to answer report values", async () => {
    const fake = createFakeProvider("gemini", [{ ok: true, text: FIXTURE.rows[0]!.model }]);
    await handleChatMessage(FIXTURE.rows[0]!.user, depsFactory(fake));
    const system = fake.calls[0]!.request.system;
    expect(system).toContain("list the active or inactive ETFs");
    expect(system).toContain("latest report date");
    expect(system).toContain("Report-value questions");
    expect(system).toContain("latest_report");
    expect(system).toContain("inactive_state");
  });
});
