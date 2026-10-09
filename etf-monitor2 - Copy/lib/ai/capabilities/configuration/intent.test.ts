import { describe, expect, it } from "vitest";
import { parseConfigurationOutput } from "./intent";

describe("parseConfigurationOutput (CI)", () => {
  it("CI-1: prose or non-JSON text is unclear/malformed", () => {
    expect(parseConfigurationOutput("Sure! Here is the JSON: {}")).toEqual({ kind: "unclear", reason: "malformed" });
    expect(parseConfigurationOutput("I cannot help")).toEqual({ kind: "unclear", reason: "malformed" });
  });

  it("CI-2: an unknown action is unsupported", () => {
    expect(parseConfigurationOutput('{"action":"rename_etf","symbol":"BTBETRETF"}')).toEqual({ kind: "unsupported" });
  });

  it("CI-3: arrays and multi-action shapes are multiple; empty array is malformed", () => {
    expect(
      parseConfigurationOutput(
        '[{"action":"add_etf","symbol":"A","name":null},{"action":"track_field","symbol":"A","field":"x"}]',
      ),
    ).toEqual({ kind: "multiple" });
    expect(parseConfigurationOutput('[{"action":"add_etf","symbol":"A","name":null}]')).toEqual({ kind: "multiple" });
    expect(
      parseConfigurationOutput('{"actions":[{"action":"add_etf","symbol":"A"},{"action":"remove_etf","symbol":"B"}]}'),
    ).toEqual({ kind: "multiple" });
    expect(
      parseConfigurationOutput('{"action":"add_etf","symbol":"A","name":null}\n{"action":"remove_etf","symbol":"B"}'),
    ).toEqual({ kind: "multiple" });
    expect(
      parseConfigurationOutput('{"action":"add_etf","symbol":"A","name":null},{"action":"remove_etf","symbol":"B"}'),
    ).toEqual({ kind: "multiple" });
    expect(parseConfigurationOutput('{"action":"multiple"}')).toEqual({ kind: "multiple" });
    expect(parseConfigurationOutput("[]")).toEqual({ kind: "unclear", reason: "malformed" });
  });

  it("CI-4: missing or wrongly-typed required properties are malformed", () => {
    expect(parseConfigurationOutput('{"action":"add_etf","name":null}')).toEqual({ kind: "unclear", reason: "malformed" });
    expect(parseConfigurationOutput('{"action":"remove_etf"}')).toEqual({ kind: "unclear", reason: "malformed" });
    expect(parseConfigurationOutput('{"action":"track_field","symbol":"A"}')).toEqual({ kind: "unclear", reason: "malformed" });
    expect(parseConfigurationOutput('{"action":"untrack_field","symbol":"A"}')).toEqual({ kind: "unclear", reason: "malformed" });
    expect(parseConfigurationOutput('{"action":"add_etf","symbol":42,"name":null}')).toEqual({ kind: "unclear", reason: "malformed" });
    expect(parseConfigurationOutput('{"action":"track_field","symbol":"A","field":null}')).toEqual({ kind: "unclear", reason: "malformed" });
    expect(parseConfigurationOutput('{"action":"add_etf","symbol":"A","name":7}')).toEqual({ kind: "unclear", reason: "malformed" });
    expect(parseConfigurationOutput('{"symbol":"A"}')).toEqual({ kind: "unclear", reason: "malformed" });
    expect(parseConfigurationOutput("null")).toEqual({ kind: "unclear", reason: "malformed" });
    expect(parseConfigurationOutput('"add_etf"')).toEqual({ kind: "unclear", reason: "malformed" });
  });

  it("CI-5: one fence (tagged or untagged) parses normally; two fences or prose before a fence are malformed", () => {
    const tagged = parseConfigurationOutput('```json\n{"action":"add_etf","symbol":"A","name":null}\n```');
    expect(tagged).toEqual({ kind: "action", action: "add_etf", symbol: "A", name: null, field: null });
    const untagged = parseConfigurationOutput('```\n{"action":"add_etf","symbol":"A","name":null}\n```');
    expect(untagged).toEqual({ kind: "action", action: "add_etf", symbol: "A", name: null, field: null });

    const twoFences = parseConfigurationOutput(
      '```json\n{"action":"add_etf","symbol":"A","name":null}\n```\n```json\n{"action":"remove_etf","symbol":"B"}\n```',
    );
    expect(twoFences).toEqual({ kind: "unclear", reason: "malformed" });

    const proseBefore = parseConfigurationOutput('Here:\n```json\n{"action":"add_etf","symbol":"A","name":null}\n```');
    expect(proseBefore).toEqual({ kind: "unclear", reason: "malformed" });
  });

  it("CI-6: absent name is null, extra properties are ignored, action casing/whitespace is accepted", () => {
    expect(parseConfigurationOutput('{"action":"add_etf","symbol":"A"}')).toEqual({
      kind: "action",
      action: "add_etf",
      symbol: "A",
      name: null,
      field: null,
    });
    const withExtra = parseConfigurationOutput('{"action":"add_etf","symbol":"A","name":null,"confidence":0.9}');
    expect(withExtra).toEqual({ kind: "action", action: "add_etf", symbol: "A", name: null, field: null });
    expect((withExtra as { confidence?: unknown }).confidence).toBeUndefined();

    expect(parseConfigurationOutput('{"action":"ADD_ETF","symbol":"A"}')).toEqual({
      kind: "action",
      action: "add_etf",
      symbol: "A",
      name: null,
      field: null,
    });
    expect(parseConfigurationOutput('{"action":" add_etf ","symbol":"A"}')).toEqual({
      kind: "action",
      action: "add_etf",
      symbol: "A",
      name: null,
      field: null,
    });
  });
});
