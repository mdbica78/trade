import { describe, expect, it } from "vitest";
import { MAX_ACTIONS_PER_MESSAGE, parseActionListOutput } from "./action-list";

const add = (symbol: string) => ({ capability: "configuration", action: "add_etf", symbol, name: null });

describe("shared action-list parser", () => {
  it("normalizes one action into the shared list shape and accepts the five-action limit", () => {
    expect(parseActionListOutput(JSON.stringify({ actions: [add("ONE")] }))).toEqual({
      kind: "actions",
      actions: [add("ONE")],
    });
    const five = Array.from({ length: MAX_ACTIONS_PER_MESSAGE }, (_, index) => add(`ETF${index}`));
    expect(parseActionListOutput(JSON.stringify({ actions: five }))).toEqual({ kind: "actions", actions: five });
  });

  it("rejects a sixth action with the fixed split-request result", () => {
    const six = Array.from({ length: MAX_ACTIONS_PER_MESSAGE + 1 }, (_, index) => add(`ETF${index}`));
    expect(parseActionListOutput(JSON.stringify({ actions: six }))).toEqual({ kind: "too_many" });
  });

  it("accepts only closed top-level envelopes and gives fixed non-action outcomes", () => {
    expect(parseActionListOutput('{"kind":"unsupported"}')).toEqual({ kind: "unsupported" });
    expect(parseActionListOutput('{"kind":"unclear"}')).toEqual({ kind: "unclear", reason: "model_unclear" });
    expect(parseActionListOutput('{"kind":"too_many"}')).toEqual({ kind: "too_many" });
    for (const text of [
      "model text",
      "[]",
      '{"actions":[]}',
      '{"actions":[null]}',
      '{"actions":[{"capability":"configuration","action":"add_etf","symbol":"X","name":null}],"extra":true}',
      '{"action":"multiple"}',
      '{"actions":[{"capability":"configuration","action":"add_etf","symbol":"X","name":null}]} trailing',
    ]) {
      expect(parseActionListOutput(text)).toEqual({ kind: "unclear", reason: "malformed" });
    }
  });
});
