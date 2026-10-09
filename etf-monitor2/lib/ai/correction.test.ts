import { describe, expect, it } from "vitest";
import type { ConfigurationContext } from "./capabilities/configuration/context";
import { buildCorrectionMessages, CORRECTION_MAX_LINES, CORRECTION_PREVIOUS_MAX_CHARS, describeFailure } from "./correction";

const context: ConfigurationContext = {
  etfs: [{
    symbol: "BTBETRETF",
    name: "BRD ETF",
    isActive: true,
    available: [{ fieldKey: "nav_per_unit", labelRo: "VUAN secret-label", labelEn: "NAV secret-label" }],
    tracked: [],
  }],
};

describe("self-correction prompt", () => {
  it("includes only closed reasons and context-grounded details, never invented text", () => {
    const line = describeFailure(2, "unknown_field", {
      capability: "widgets",
      action: "widget_add",
      etf: "BTBETRETF",
      definition: { operation: "max", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7, title: "attacker title" },
    }, context);
    expect(line).toBe("action 2: unknown_field (BTBETRETF, nav_per_unit, max, days, 7)");
    expect(line).not.toContain("attacker");
    expect(line).not.toContain("secret-label");
  });

  it("bounds lines and previous model output while preserving the message order", () => {
    const lines = Array.from({ length: CORRECTION_MAX_LINES + 2 }, (_, i) => `action ${i}: bad_period`);
    const messages = buildCorrectionMessages(
      [{ role: "assistant", content: "prior" }],
      "latest request",
      "x".repeat(CORRECTION_PREVIOUS_MAX_CHARS + 200),
      lines,
    );
    expect(messages.map((m) => m.role)).toEqual(["assistant", "user", "assistant", "user"]);
    expect(messages[1]?.content).toBe("latest request");
    expect(messages[2]?.content).toHaveLength(CORRECTION_PREVIOUS_MAX_CHARS);
    expect(messages[3]?.content).toContain(`… and 2 more`);
    expect(messages[3]?.content).not.toContain("x".repeat(20));
  });

  it("uses a fixed description for an unparseable answer", () => {
    expect(describeFailure(null, "malformed", "untrusted text", context))
      .toBe('answer: unparseable (one JSON object {"reply","actions","question"} expected)');
  });
});
