import { describe, expect, it } from "vitest";
import { CHAT_UNAVAILABLE_REASONS, type ChatActionResult, type ChatOutcome } from "@/lib/ai/chat";
import { PROVIDER_ERROR_CODES } from "@/lib/ai/providers/types";
import { UNCLEAR_REASONS } from "@/lib/ai/capabilities/configuration/intent";
import { EXECUTION_CODES, type ExecutionCode } from "@/lib/ai/capabilities/configuration/execute";
import { chatOutcomeToReply, changedActions } from "./reply-messages";

const CHANGING_CODES: readonly ExecutionCode[] = [
  "added", "added_no_adapter", "reactivated", "removed", "tracked", "untracked",
];
const FIELD = { fieldKey: "net_asset", labelRo: "Activ net", labelEn: "Net asset" };

function configurationResult(code: ExecutionCode): ChatActionResult {
  const needsField = ["tracked", "already_tracked", "untracked", "not_tracked"].includes(code);
  return {
    index: 1,
    status: "done",
    capability: "configuration",
    action: "track_field",
    symbol: "BTBETRETF",
    changed: CHANGING_CODES.includes(code),
    configuration: {
      code,
      symbol: "BTBETRETF",
      field: needsField ? FIELD : null,
      adapterKey: code === "added" ? "brd-depositary" : null,
      detectionReason: code === "added_no_adapter" ? "no_match" : null,
      changed: CHANGING_CODES.includes(code),
    },
    ...(needsField ? { field: FIELD } : {}),
  };
}

describe("reply-messages golden (G-R1, US-051 AC4, written before the C13 refactor)", () => {
  it.each(EXECUTION_CODES)("G-R1 single configuration action, code=%s", (code) => {
    expect(chatOutcomeToReply({ kind: "executed_actions", results: [configurationResult(code)] })).toMatchSnapshot();
  });

  it("G-R1 single widget_add done, changed:true, slot:1", () => {
    const result: ChatActionResult = {
      index: 1, status: "done", capability: "widgets", action: "widget_add", symbol: "BTBETRETF",
      changed: true, widget: { action: "widget_add", symbol: "BTBETRETF", changed: true, slot: 1 },
    };
    expect(chatOutcomeToReply({ kind: "executed_actions", results: [result] })).toMatchSnapshot();
  });

  it("G-R1 single widget_clear done, changed:false, slot:null", () => {
    const result: ChatActionResult = {
      index: 1, status: "done", capability: "widgets", action: "widget_clear", symbol: "BTBETRETF",
      changed: false, widget: { action: "widget_clear", symbol: "BTBETRETF", changed: false, slot: null },
    };
    expect(chatOutcomeToReply({ kind: "executed_actions", results: [result] })).toMatchSnapshot();
  });

  it("G-R1 single thrown failure (configuration undefined)", () => {
    const result: ChatActionResult = {
      index: 1, status: "failed", capability: "widgets", action: "widget_add", symbol: "BTBETRETF", changed: false,
    };
    expect(chatOutcomeToReply({ kind: "executed_actions", results: [result] })).toMatchSnapshot();
  });

  it("G-R1/G-R2 3-item list done/failed/not_run", () => {
    const results: ChatActionResult[] = [
      { index: 1, status: "done", capability: "configuration", action: "track_field", symbol: "BTBETRETF", changed: true,
        configuration: { code: "tracked", symbol: "BTBETRETF", field: FIELD, adapterKey: null, detectionReason: null, changed: true },
        field: FIELD },
      { index: 2, status: "failed", capability: "widgets", action: "widget_add", symbol: "BTBETRETF", changed: false },
      { index: 3, status: "not_run", capability: "configuration", action: "remove_etf", symbol: "BTBETRETF", changed: false },
    ];
    const outcome: ChatOutcome = { kind: "executed_actions", results };
    expect(chatOutcomeToReply(outcome)).toMatchSnapshot();
    expect(changedActions(outcome)).toMatchSnapshot();
  });

  it("G-R1 2-item list with a returned configuration failure", () => {
    const results: ChatActionResult[] = [
      { index: 1, status: "done", capability: "configuration", action: "untrack_field", symbol: "BTBETRETF", changed: true,
        configuration: { code: "untracked", symbol: "BTBETRETF", field: null, adapterKey: null, detectionReason: null, changed: true } },
      { index: 2, status: "failed", capability: "configuration", action: "untrack_field", symbol: "BTBETRETF", changed: false,
        configuration: { code: "not_tracked", symbol: "BTBETRETF", field: null, adapterKey: null, detectionReason: null, changed: false } },
    ];
    expect(chatOutcomeToReply({ kind: "executed_actions", results })).toMatchSnapshot();
  });

  it.each(PROVIDER_ERROR_CODES)("G-R1 interpreted/provider_error/%s", (error) => {
    expect(chatOutcomeToReply({ kind: "interpreted", outcome: { kind: "provider_error", error } })).toMatchSnapshot();
  });

  it("G-R1 interpreted/unsupported", () => {
    expect(chatOutcomeToReply({ kind: "interpreted", outcome: { kind: "unsupported" } })).toMatchSnapshot();
  });

  it("G-R1 interpreted/too_many", () => {
    expect(chatOutcomeToReply({ kind: "interpreted", outcome: { kind: "too_many" } })).toMatchSnapshot();
  });

  it.each(UNCLEAR_REASONS.filter((r) => r === "malformed" || r === "model_unclear"))(
    "G-R1 interpreted/unclear/%s",
    (reason) => {
      expect(chatOutcomeToReply({ kind: "interpreted", outcome: { kind: "unclear", reason } })).toMatchSnapshot();
    },
  );

  it("G-R1 invalid_action", () => {
    expect(chatOutcomeToReply({ kind: "invalid_action", index: 2, reason: "unknown_field" })).toMatchSnapshot();
  });

  it("G-R1 key_request", () => {
    expect(chatOutcomeToReply({ kind: "key_request" })).toMatchSnapshot();
  });

  it.each(CHAT_UNAVAILABLE_REASONS)("G-R1 unavailable/%s", (reason) => {
    expect(chatOutcomeToReply({ kind: "unavailable", reason })).toMatchSnapshot();
  });

  it("G-R1 error", () => {
    expect(chatOutcomeToReply({ kind: "error" })).toMatchSnapshot();
  });
});
