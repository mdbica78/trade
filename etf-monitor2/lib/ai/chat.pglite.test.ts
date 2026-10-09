import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import { seed } from "../db/seed";
import { createFakeProvider } from "../../test/helpers/ai-fakes";
import { createProviderRegistry } from "./providers/registry";
import { confirmChatPlan, handleChatMessage } from "./chat";
import { chatOutcomeToReply } from "../../app/chat/reply-messages";
import type { ChatDeps } from "./chat";
import type { ProviderDeps } from "./provider-deps";
import { createHomeTableLoader } from "../monitoring/home";
import { createDrizzleEtfLoader } from "../ingestion/load-etfs";

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

function depsFactory(fake: ReturnType<typeof createFakeProvider>, detect = vi.fn()): () => ChatDeps {
  const provider: ProviderDeps = {
    loadSettings: async () => ({ provider: "gemini", model: "m-1" }),
    loadStoredKeys: async () => new Map(),
    registry: createProviderRegistry([fake]),
    readApiKey: () => "k-test",
    fetch: fetchSpy,
  };
  return () => ({
    provider,
    config: { db: db.mockDb, run: db.runner, registry: defaultAdapterRegistry, detect, now: () => new Date("2026-09-27T08:00:00Z") },
    widgets: { db: db.mockDb, run: db.runner, registry: defaultAdapterRegistry, now: () => new Date("2026-09-27T08:00:00Z") },
    planKey: () => new Uint8Array(32).fill(7),
  });
}

/** US-058: confirm-category outcomes (remove_etf, untrack_field, multi-ETF widget_clear/replace)
 * now propose first; this resolves the one call needed to execute, keeping the rest of a test's
 * assertions unchanged. */
async function confirmed(outcome: Awaited<ReturnType<typeof handleChatMessage>>, deps: () => ChatDeps) {
  if (outcome.kind !== "proposed") return outcome;
  return confirmChatPlan(outcome.token, deps);
}

const output = (action: string, fields: Record<string, unknown>) =>
  JSON.stringify({ actions: [{ capability: "configuration", action, ...fields }] });

async function homeTable() {
  return createHomeTableLoader(db.mockDb, defaultAdapterRegistry, db.runner)();
}

async function dailyEtfs() {
  return createDrizzleEtfLoader(db.mockDb, db.runner)();
}

async function snapshot() {
  return {
    etfs: (await db.pg.query('select * from "etfs" order by "id"')).rows,
    trackedFields: (await db.pg.query('select * from "tracked_fields" order by "id"')).rows,
    reports: (await db.pg.query('select * from "reports" order by "id"')).rows,
    reportValues: (await db.pg.query('select * from "report_values" order by "id"')).rows,
  };
}

describe("handleChatMessage end to end against a seeded database (CEP, AC2/AC3/AC5)", () => {
  it("CEP-C1 (US-058): remove_etf leaves the database untouched until the signed proposal is confirmed", async () => {
    const before = await snapshot();
    const fake = createFakeProvider("gemini", [{ ok: true, text: output("remove_etf", { symbol: "BTBETRETF" }) }]);
    const deps = depsFactory(fake);
    const proposal = await handleChatMessage("remove ETF BTBETRETF", deps);
    expect(proposal.kind).toBe("proposed");
    expect(await snapshot()).toEqual(before);
    if (proposal.kind !== "proposed") return;

    const outcome = await confirmChatPlan(proposal.token, deps);
    expect(outcome).toMatchObject({ kind: "executed_actions", results: [{ status: "done", action: "remove_etf", symbol: "BTBETRETF" }] });
    const rows = (await db.pg.query('select "is_active" from "etfs" where "symbol" = $1', ["BTBETRETF"])).rows as { is_active: boolean }[];
    expect(rows[0]?.is_active).toBe(false);
    expect(fake.calls).toHaveLength(1);

    const afterFirstConfirmation = await snapshot();
    expect(await confirmChatPlan(proposal.token, deps)).toEqual({ kind: "plan_refused", reason: "state_changed" });
    expect(await snapshot()).toEqual(afterFirstConfirmation);
    expect(fake.calls).toHaveLength(1);
  });

  it("CEP-1: add ETF XYZ inserts one active row with name = symbol and no adapter", async () => {
    const detect = vi.fn().mockResolvedValue({ adapterKey: null, reason: "no_match" });
    const fake = createFakeProvider("gemini", [{ ok: true, text: output("add_etf", { symbol: "XYZ", name: null }) }]);
    const outcome = await handleChatMessage("add ETF XYZ", depsFactory(fake, detect));
    expect(outcome).toMatchObject({ kind: "executed_actions", results: [{ status: "done", configuration: { code: "added_no_adapter", symbol: "XYZ", changed: true } }] });
    expect(detect).toHaveBeenCalledTimes(1);
    const rows = (await db.pg.query('select "name", "is_active", "adapter_key" from "etfs" where "symbol" = $1', ["XYZ"])).rows;
    expect(rows).toEqual([{ name: "XYZ", is_active: true, adapter_key: null }]);
    const home = await homeTable();
    expect(home.rows.some((r) => r.symbol === "XYZ")).toBe(true);
  });

  it("CEP-5: add ETF XYZ named Fond Test stores that name", async () => {
    const detect = vi.fn().mockResolvedValue({ adapterKey: null, reason: "no_match" });
    const fake = createFakeProvider("gemini", [{ ok: true, text: output("add_etf", { symbol: "XYZ", name: "Fond Test" }) }]);
    await handleChatMessage("add ETF XYZ named Fond Test", depsFactory(fake, detect));
    const rows = (await db.pg.query('select "name" from "etfs" where "symbol" = $1', ["XYZ"])).rows as { name: string }[];
    expect(rows[0]?.name).toBe("Fond Test");
  });

  it("CEP-2: stop tracking ETF BTBETRETF deactivates it and leaves its reports/tracked fields unchanged", async () => {
    const before = await snapshot();
    const fake = createFakeProvider("gemini", [{ ok: true, text: output("remove_etf", { symbol: "BTBETRETF" }) }]);
    const deps = depsFactory(fake);
    const outcome = await confirmed(await handleChatMessage("stop tracking ETF BTBETRETF", deps), deps);
    expect(outcome).toMatchObject({ kind: "executed_actions", results: [{ status: "done", configuration: { code: "removed", symbol: "BTBETRETF" } }] });
    const rows = (await db.pg.query('select "is_active" from "etfs" where "symbol" = $1', ["BTBETRETF"])).rows as {
      is_active: boolean;
    }[];
    expect(rows[0]?.is_active).toBe(false);
    const after = await snapshot();
    expect(after.trackedFields).toEqual(before.trackedFields);
    expect(after.reports).toEqual(before.reports);
    expect(after.reportValues).toEqual(before.reportValues);
    const home = await homeTable();
    expect(home.rows.some((r) => r.symbol === "BTBETRETF")).toBe(false);
    const daily = await dailyEtfs();
    expect(daily.some((e) => e.symbol === "BTBETRETF")).toBe(false);
  });

  it("CEP-3: also track net asset for BTBETRETF adds the net_asset tracked field", async () => {
    const fake = createFakeProvider("gemini", [
      { ok: true, text: output("track_field", { symbol: "BTBETRETF", field: "net_asset" }) },
    ]);
    const outcome = await handleChatMessage("also track net asset for BTBETRETF", depsFactory(fake));
    expect(outcome).toMatchObject({
      kind: "executed_actions",
      results: [{ status: "done", configuration: { code: "tracked", symbol: "BTBETRETF" }, field: { fieldKey: "net_asset", labelRo: "Activ net", labelEn: "Net asset" } }],
    });
    const rows = (await db.pg.query(
      `select "t"."field_key" from "tracked_fields" "t" join "etfs" "e" on "e"."id" = "t"."etf_id" where "e"."symbol" = $1`,
      ["BTBETRETF"],
    )).rows as { field_key: string }[];
    expect(rows.map((r) => r.field_key)).toContain("net_asset");
    const home = await homeTable();
    expect(home.columns.map((c) => c.fieldKey)).toContain("net_asset");
  });

  it("CEP-4: stop tracking VUAN for BTBETRETF removes nav_per_unit but keeps report_values", async () => {
    const before = await snapshot();
    const fake = createFakeProvider("gemini", [
      { ok: true, text: output("untrack_field", { symbol: "BTBETRETF", field: "nav_per_unit" }) },
    ]);
    const deps = depsFactory(fake);
    const outcome = await confirmed(await handleChatMessage("stop tracking VUAN for BTBETRETF", deps), deps);
    expect(outcome).toMatchObject({ kind: "executed_actions", results: [{ status: "done", configuration: { code: "untracked", symbol: "BTBETRETF" } }] });
    const rows = (await db.pg.query(
      `select "t"."field_key" from "tracked_fields" "t" join "etfs" "e" on "e"."id" = "t"."etf_id" where "e"."symbol" = $1`,
      ["BTBETRETF"],
    )).rows as { field_key: string }[];
    expect(rows.map((r) => r.field_key)).not.toContain("nav_per_unit");
    const after = await snapshot();
    expect(after.reportValues).toEqual(before.reportValues);
    const daily = await dailyEtfs();
    expect(daily.find((e) => e.symbol === "BTBETRETF")!.trackedFieldKeys).not.toContain("nav_per_unit");
  });

  it("CEP-6: add ETF PTENGETF reactivates an inactive ETF, keeps its name/adapter, calls no detection", async () => {
    await db.pg.query('update "etfs" set "is_active" = false where "symbol" = $1', ["PTENGETF"]);
    const detect = vi.fn();
    const fake = createFakeProvider("gemini", [{ ok: true, text: output("add_etf", { symbol: "PTENGETF", name: null }) }]);
    const outcome = await handleChatMessage("add ETF PTENGETF", depsFactory(fake, detect));
    expect(outcome).toMatchObject({ kind: "executed_actions", results: [{ status: "done", configuration: { code: "reactivated", symbol: "PTENGETF" } }] });
    expect(detect).not.toHaveBeenCalled();
    const rows = (await db.pg.query('select "name", "adapter_key", "is_active" from "etfs" where "symbol" = $1', ["PTENGETF"]))
      .rows as { name: string; adapter_key: string; is_active: boolean }[];
    expect(rows[0]).toEqual({ name: "Fondul Deschis de Investiții ETF Energie Patria-Tradeville", adapter_key: "brd-depositary", is_active: true });
  });

  it("CEP-8: add ETF BTBETRETF (already active) -> already_monitored, no detection, tables unchanged", async () => {
    const detect = vi.fn();
    const before = await snapshot();
    const fake = createFakeProvider("gemini", [{ ok: true, text: output("add_etf", { symbol: "BTBETRETF", name: null }) }]);
    const outcome = await handleChatMessage("add ETF BTBETRETF", depsFactory(fake, detect));
    expect(outcome).toMatchObject({ kind: "executed_actions", results: [{ status: "done", configuration: { code: "already_monitored" } }] });
    expect(detect).not.toHaveBeenCalled();
    expect(await snapshot()).toEqual(before);
  });

  it("CEP-9: also track VUAN for BTBETRETF (already tracked by the seed) is caught by grounding before execute", async () => {
    const fake = createFakeProvider("gemini", [
      { ok: true, text: output("track_field", { symbol: "BTBETRETF", field: "nav_per_unit" }) },
    ]);
    const outcome = await handleChatMessage("also track VUAN for BTBETRETF", depsFactory(fake));
    expect(outcome).toEqual({
      kind: "invalid_action", index: 1, reason: "already_tracked",
      field: { fieldKey: "nav_per_unit", labelRo: "Valoare unitară a activului net (VUAN)", labelEn: "Net asset value per unit" },
    });
  });

  it("CEP-11: stop tracking ETF PTENGETF when it is already inactive -> already_inactive, row stays inactive", async () => {
    await db.pg.query('update "etfs" set "is_active" = false where "symbol" = $1', ["PTENGETF"]);
    const fake = createFakeProvider("gemini", [{ ok: true, text: output("remove_etf", { symbol: "PTENGETF" }) }]);
    const deps = depsFactory(fake);
    const outcome = await confirmed(await handleChatMessage("stop tracking ETF PTENGETF", deps), deps);
    expect(outcome).toMatchObject({ kind: "executed_actions", results: [{ status: "done", configuration: { code: "already_inactive", changed: false } }] });
    const rows = (await db.pg.query('select "is_active" from "etfs" where "symbol" = $1', ["PTENGETF"])).rows as {
      is_active: boolean;
    }[];
    expect(rows[0]?.is_active).toBe(false);
  });

  it("CEP-12: an unconfigured provider makes no request and leaves the database unchanged", async () => {
    const before = await snapshot();
    const fake = createFakeProvider("gemini");
    const provider: ProviderDeps = {
      loadSettings: async () => ({ provider: null, model: null }),
      loadStoredKeys: async () => new Map(),
      registry: createProviderRegistry([fake]),
      readApiKey: () => "k-test",
      fetch: fetchSpy,
    };
    const detect = vi.fn();
    const outcome = await handleChatMessage("add ETF XYZ", () => ({
      provider,
      config: { db: db.mockDb, run: db.runner, registry: defaultAdapterRegistry, detect, now: () => new Date("2026-09-27T08:00:00Z") },
      widgets: { db: db.mockDb, run: db.runner, registry: defaultAdapterRegistry, now: () => new Date("2026-09-27T08:00:00Z") },
    }));
    expect(outcome).toEqual({ kind: "unavailable", reason: "not_configured" });
    expect(fake.calls).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(detect).not.toHaveBeenCalled();
    expect(await snapshot()).toEqual(before);
  });

  it("US-045: validates a mixed configuration/widget list before applying both writes", async () => {
    const fake = createFakeProvider("gemini", [{
      ok: true,
      text: JSON.stringify({
        actions: [
          { capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "net_asset" },
          {
            capability: "widgets",
            action: "widget_add",
            etf: "BTBETRETF",
            definition: { operation: "change", fieldKey: "net_asset", periodUnit: "reports", periodAmount: 2 },
          },
        ],
      }),
    }]);
    const outcome = await handleChatMessage(
      "track net asset and add a custom value for BTBETRETF",
      depsFactory(fake),
    );
    expect(outcome).toMatchObject({
      kind: "executed_actions",
      results: [{ status: "done", capability: "configuration" }, { status: "done", capability: "widgets" }],
    });
    expect((await db.pg.query(
      `select "field_key" from "tracked_fields" "t" join "etfs" "e" on "e"."id" = "t"."etf_id"
       where "e"."symbol" = 'BTBETRETF' and "field_key" = 'net_asset'`,
    )).rows).toHaveLength(1);
    expect((await db.pg.query(
      `select "operation", "field_key", "period_unit", "period_amount" from "etf_widgets"
       where "etf_id" = (select "id" from "etfs" where "symbol" = 'BTBETRETF')`,
    )).rows).toEqual([{ operation: "change", field_key: "net_asset", period_unit: "reports", period_amount: 2 }]);
  });

  async function insertWidget(symbol: string, slot: number, operation: string, fieldKey: string, periodUnit: string, periodAmount: number) {
    await db.pg.query(
      `insert into "etf_widgets" ("etf_id", "slot", "operation", "field_key", "period_unit", "period_amount", "updated_at")
       values ((select "id" from "etfs" where "symbol" = $1), $2, $3, $4, $5, $6, now())`,
      [symbol, slot, operation, fieldKey, periodUnit, periodAmount],
    );
  }

  async function widgetSlots(symbol: string): Promise<number[]> {
    const rows = (await db.pg.query(
      `select "slot" from "etf_widgets" where "etf_id" = (select "id" from "etfs" where "symbol" = $1) order by "slot"`,
      [symbol],
    )).rows as { slot: number }[];
    return rows.map((r) => r.slot);
  }

  describe("US-053: * (all ETFs) and match-based widget actions", () => {
    beforeEach(async () => {
      await insertWidget("BTBETRETF", 1, "max", "units_in_circulation", "days", 30);
      await insertWidget("BTBETRETF", 2, "min", "units_in_circulation", "days", 7);
      await insertWidget("BTBETRETF", 3, "average", "nav_per_unit", "days", 30);
      await insertWidget("TVBETETF", 1, "max", "units_in_circulation", "days", 30);
      await insertWidget("TVBETETF", 2, "min", "units_in_circulation", "days", 7);
      await insertWidget("PTENGETF", 1, "min", "units_in_circulation", "days", 7);
    });

    const clearOutput = (match: Record<string, unknown>) =>
      JSON.stringify({ actions: [{ capability: "widgets", action: "widget_clear", etf: "*", match }] });

    it("T-1/T-3: clear max/units/30d for all etf removes it where present, matched:0 elsewhere", async () => {
      const fake = createFakeProvider("gemini", [{
        ok: true,
        text: clearOutput({ operation: "max", fieldKey: "units_in_circulation", periodUnit: "days", periodAmount: 30 }),
      }]);
      const deps = depsFactory(fake);
      const outcome = await confirmed(await handleChatMessage("clear max value for units in circulation for last month for all etf", deps), deps);
      expect(outcome).toMatchObject({
        kind: "executed_actions",
        results: [
          { index: 1, status: "done", symbol: "BTBETRETF", changed: true },
          { index: 1, status: "done", symbol: "PTENGETF", changed: false, widget: { matched: 0 } },
          { index: 1, status: "done", symbol: "TVBETETF", changed: true },
        ],
      });
      expect(await widgetSlots("BTBETRETF")).toEqual([2, 3]);
      expect(await widgetSlots("PTENGETF")).toEqual([1]);
      expect(await widgetSlots("TVBETETF")).toEqual([2]);

      const reply = chatOutcomeToReply(outcome);
      expect(reply.messageKey).toBe("actionsComplete");
      expect(reply.actions?.map((a) => a.messageKey)).toEqual(["widgetCleared", "widgetNothingMatched"]);
      expect(reply.actions?.map((a) => a.values?.symbol)).toEqual(["BTBETRETF, TVBETETF", "PTENGETF"]);
    });

    it("T-2: clear min/units/7d for all etf removes the matching widget on every ETF, keeps others", async () => {
      const fake = createFakeProvider("gemini", [{
        ok: true,
        text: clearOutput({ operation: "min", fieldKey: "units_in_circulation", periodUnit: "days", periodAmount: 7 }),
      }]);
      const deps = depsFactory(fake);
      const outcome = await confirmed(await handleChatMessage("clear min value for units in circulation for last 7 days for all etf", deps), deps);
      expect(outcome).toMatchObject({ kind: "executed_actions", results: [{ status: "done" }, { status: "done" }, { status: "done" }] });
      expect(await widgetSlots("BTBETRETF")).toEqual([1, 3]);
      expect(await widgetSlots("TVBETETF")).toEqual([1]);
      expect(await widgetSlots("PTENGETF")).toEqual([]);
    });

    it("T-4: widget_update by match over * changes periodAmount only on the matching widgets", async () => {
      const fake = createFakeProvider("gemini", [{
        ok: true,
        text: JSON.stringify({
          actions: [{
            capability: "widgets", action: "widget_update", etf: "*",
            match: { operation: "max", fieldKey: "units_in_circulation", periodUnit: "days", periodAmount: 30 },
            changes: { periodAmount: 90 },
          }],
        }),
      }]);
      const outcome = await handleChatMessage("change the 30 day max to 90 days for all etf", depsFactory(fake));
      expect(outcome).toMatchObject({ kind: "executed_actions", results: [{ status: "done" }, { status: "done" }, { status: "done" }] });
      const btAmounts = (await db.pg.query(
        `select "period_amount" from "etf_widgets" where "etf_id" = (select "id" from "etfs" where "symbol" = 'BTBETRETF') and "slot" = 1`,
      )).rows as { period_amount: number }[];
      expect(btAmounts[0]?.period_amount).toBe(90);
      const tvAmounts = (await db.pg.query(
        `select "period_amount" from "etf_widgets" where "etf_id" = (select "id" from "etfs" where "symbol" = 'TVBETETF') and "slot" = 1`,
      )).rows as { period_amount: number }[];
      expect(tvAmounts[0]?.period_amount).toBe(90);
      const ptRows = (await db.pg.query(
        `select "period_amount" from "etf_widgets" where "etf_id" = (select "id" from "etfs" where "symbol" = 'PTENGETF')`,
      )).rows as { period_amount: number }[];
      expect(ptRows.map((r) => r.period_amount)).toEqual([7]);
    });

    it("T-5: add max/units/7d with no ETF named defaults to * and adds one widget per active ETF", async () => {
      const fake = createFakeProvider("gemini", [{
        ok: true,
        text: JSON.stringify({
          actions: [{
            capability: "widgets", action: "widget_add", etf: "*",
            definition: { operation: "max", fieldKey: "units_in_circulation", periodUnit: "days", periodAmount: 7 },
          }],
        }),
      }]);
      const outcome = await handleChatMessage("add max value for units in circulation for last 7 days", depsFactory(fake));
      expect(outcome).toMatchObject({ kind: "executed_actions", results: [{ status: "done" }, { status: "done" }, { status: "done" }] });
      expect(await widgetSlots("BTBETRETF")).toEqual([1, 2, 3, 4]);
      expect(await widgetSlots("TVBETETF")).toEqual([1, 2, 3]);
      expect(await widgetSlots("PTENGETF")).toEqual([1, 2]);
    });

    it("T-6: * expansion fails validation on one ETF (too_many) and leaves every etf_widgets row unchanged", async () => {
      for (const extraSlot of [2, 3, 4, 5, 6]) {
        await insertWidget("PTENGETF", extraSlot, "average", "nav_per_unit", "days", extraSlot * 10);
      }
      const before = await widgetSlots("PTENGETF");
      const beforeBt = await widgetSlots("BTBETRETF");
      const fake = createFakeProvider("gemini", [{
        ok: true,
        text: JSON.stringify({
          actions: [{
            capability: "widgets", action: "widget_add", etf: "*",
            definition: { operation: "max", fieldKey: "nav_per_unit", periodUnit: "reports", periodAmount: 5 },
          }],
        }),
      }]);
      const outcome = await handleChatMessage("add a custom value for all etf", depsFactory(fake));
      expect(outcome).toEqual({ kind: "invalid_action", index: 1, reason: "too_many", symbol: "PTENGETF" });
      expect(await widgetSlots("PTENGETF")).toEqual(before);
      expect(await widgetSlots("BTBETRETF")).toEqual(beforeBt);
    });

    it("T-7: an inactive ETF is excluded from * expansion and rejected when named explicitly", async () => {
      await db.pg.query('update "etfs" set "is_active" = false where "symbol" = $1', ["PTENGETF"]);

      const addFake = createFakeProvider("gemini", [{
        ok: true,
        text: JSON.stringify({
          actions: [{
            capability: "widgets", action: "widget_add", etf: "*",
            definition: { operation: "max", fieldKey: "units_in_circulation", periodUnit: "days", periodAmount: 7 },
          }],
        }),
      }]);
      const addOutcome = await handleChatMessage("add max value for units in circulation for last 7 days", depsFactory(addFake));
      expect(addOutcome).toMatchObject({ kind: "executed_actions", results: [{ status: "done" }, { status: "done" }] });
      expect(await widgetSlots("PTENGETF")).toEqual([1]);

      const untrackFake = createFakeProvider("gemini", [{
        ok: true,
        text: JSON.stringify({
          actions: [{ capability: "configuration", action: "untrack_field", symbol: "*", field: "units_in_circulation" }],
        }),
      }]);
      const untrackDeps = depsFactory(untrackFake);
      const untrackOutcome = await confirmed(await handleChatMessage("stop tracking units in circulation for all etf", untrackDeps), untrackDeps);
      expect(untrackOutcome).toMatchObject({ kind: "executed_actions", results: [{ status: "done" }, { status: "done" }] });
      const ptRows = (await db.pg.query(
        `select "field_key" from "tracked_fields" "t" join "etfs" "e" on "e"."id" = "t"."etf_id" where "e"."symbol" = 'PTENGETF'`,
      )).rows as { field_key: string }[];
      expect(ptRows.map((r) => r.field_key)).toContain("units_in_circulation");

      const trackFake = createFakeProvider("gemini", [{
        ok: true,
        text: output("track_field", { symbol: "PTENGETF", field: "net_asset" }),
      }]);
      const trackOutcome = await handleChatMessage("track net asset for PTENGETF", depsFactory(trackFake));
      expect(trackOutcome).toEqual({ kind: "invalid_action", index: 1, reason: "etf_inactive", symbol: "PTENGETF" });

      const widgetFake = createFakeProvider("gemini", [{
        ok: true,
        text: JSON.stringify({
          actions: [{
            capability: "widgets", action: "widget_add", etf: "PTENGETF",
            definition: { operation: "max", fieldKey: "units_in_circulation", periodUnit: "days", periodAmount: 7 },
          }],
        }),
      }]);
      const widgetOutcome = await handleChatMessage("add max value for units in circulation for PTENGETF", depsFactory(widgetFake));
      expect(widgetOutcome).toEqual({ kind: "invalid_action", index: 1, reason: "etf_inactive", symbol: "PTENGETF" });
      expect(await widgetSlots("PTENGETF")).toEqual([1]);
    });

    it("T-8: the system prompt sent by handleChatMessage contains a real inserted widget", async () => {
      const fake = createFakeProvider("gemini", [{ ok: true, text: '{"kind":"unsupported"}' }]);
      await handleChatMessage("what do I have set up", depsFactory(fake));
      const system = fake.calls[0]?.request.system ?? "";
      const open = system.indexOf("<catalogue_data>") + "<catalogue_data>".length;
      const close = system.indexOf("</catalogue_data>");
      const dataBlock = system.slice(open, close);
      expect(dataBlock).toContain('"operation":"max"');
      expect(dataBlock).toContain('"fieldKey":"units_in_circulation"');
      expect(dataBlock).toContain('"periodAmount":30');
    });
  });

  it("US-045: an invalid later widget action prevents every earlier configuration write", async () => {
    const before = await db.pg.query(
      `select "field_key" from "tracked_fields" "t" join "etfs" "e" on "e"."id" = "t"."etf_id"
       where "e"."symbol" = 'BTBETRETF' order by "field_key"`,
    );
    const fake = createFakeProvider("gemini", [{
      ok: true,
      text: JSON.stringify({
        actions: [
          { capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "net_asset" },
          {
            capability: "widgets",
            action: "widget_add",
            etf: "BTBETRETF",
            definition: { operation: "change", fieldKey: "unknown", periodUnit: "days", periodAmount: 7 },
          },
        ],
      }),
    }]);
    const outcome = await handleChatMessage(
      "track net asset and add a custom value for BTBETRETF",
      depsFactory(fake),
    );
    expect(outcome).toEqual({ kind: "invalid_action", index: 2, reason: "unknown_field" });
    expect((await db.pg.query(
      `select "field_key" from "tracked_fields" "t" join "etfs" "e" on "e"."id" = "t"."etf_id"
       where "e"."symbol" = 'BTBETRETF' order by "field_key"`,
    )).rows).toEqual(before.rows);
    expect((await db.pg.query('select "id" from "etf_widgets"')).rows).toHaveLength(0);
  });
});
