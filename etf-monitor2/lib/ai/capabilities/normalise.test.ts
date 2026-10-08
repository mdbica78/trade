import { describe, expect, it } from "vitest";
import { seedFieldCatalog } from "../../db/seed-data";
import { normaliseModelAction, OPERATION_SYNONYMS } from "./normalise";
import { parseConfigurationAction } from "./configuration/intent";
import { groundAction } from "./configuration/grounding";
import { validateWidgetAction } from "./widgets/intent";
import type { ConfigurationContext } from "./configuration/context";
import type { WidgetContext } from "./widgets/context";

function fieldsFor(adapterKey: string) {
  return seedFieldCatalog
    .filter((f) => f.adapterKey === adapterKey)
    .map((f) => ({ fieldKey: f.fieldKey, labelRo: f.labelRo, labelEn: f.labelEn }));
}

const BRD_FIELDS = fieldsFor("brd-depositary");
const ICB_FIELDS = fieldsFor("intercapital-nav");

function buildContext(): ConfigurationContext {
  return {
    etfs: [
      { symbol: "BTBETRETF", name: "BRD ETF", isActive: true, available: BRD_FIELDS, tracked: BRD_FIELDS },
      { symbol: "ICBETNETF", name: "InterCapital ETF", isActive: true, available: ICB_FIELDS, tracked: ICB_FIELDS },
    ],
  };
}

function widgetContextFor(context: ConfigurationContext): WidgetContext {
  return { etfs: context.etfs.map((etf) => ({ symbol: etf.symbol, available: etf.available, widgets: [] })) };
}

describe("normaliseModelAction (NM)", () => {
  it("NM-1: widgets action with symbol and no etf renames the key, value unchanged", () => {
    const context = buildContext();
    for (const value of ["BTBETRETF", "*"]) {
      const action = { capability: "widgets", action: "widget_add", symbol: value, definition: {} };
      expect(normaliseModelAction(action, context)).toEqual({
        capability: "widgets", action: "widget_add", etf: value, definition: {},
      });
    }
  });

  it("NM-2: configuration action with etf and no symbol renames the key, value unchanged", () => {
    const context = buildContext();
    for (const [action, value] of [
      ["add_etf", "ABCETF"], ["remove_etf", "ABCETF"], ["track_field", "*"], ["untrack_field", "*"],
    ] as const) {
      const raw = { capability: "configuration", action, etf: value };
      expect(normaliseModelAction(raw, context)).toEqual({ capability: "configuration", action, symbol: value });
    }
  });

  it("NM-3: both etf and symbol present returns unchanged", () => {
    const context = buildContext();
    const action = { capability: "widgets", action: "widget_add", etf: "BTBETRETF", symbol: "BTBETRETF", definition: {} };
    expect(normaliseModelAction(action, context)).toEqual(action);
    const config = { capability: "configuration", action: "track_field", etf: "X", symbol: "X", field: "f" };
    expect(normaliseModelAction(config, context)).toEqual(config);
  });

  it("NM-3b: neither etf nor symbol present returns unchanged", () => {
    const context = buildContext();
    const action = { capability: "widgets", action: "widget_clear" };
    expect(normaliseModelAction(action, context)).toEqual(action);
  });

  it("NM-4: digit-only period amounts become integers in every location", () => {
    const context = buildContext();
    for (const [raw, expected] of [["7", 7], [" 30 ", 30], ["07", 7]] as const) {
      const action = {
        capability: "widgets", action: "widget_add", etf: "BTBETRETF",
        definition: { periodAmount: raw },
        changes: { periodAmount: raw },
        match: { periodAmount: raw },
        definitions: [{ periodAmount: raw }],
        slot: raw,
      };
      const result = normaliseModelAction(action, context) as Record<string, unknown>;
      expect((result.definition as Record<string, unknown>).periodAmount).toBe(expected);
      expect((result.changes as Record<string, unknown>).periodAmount).toBe(expected);
      expect((result.match as Record<string, unknown>).periodAmount).toBe(expected);
      expect(((result.definitions as Record<string, unknown>[])[0]!).periodAmount).toBe(expected);
      expect(result.slot).toBe(expected);
    }
  });

  it("NM-4b: non-digit-only period amounts are left unchanged", () => {
    const context = buildContext();
    for (const raw of ["7.5", "-3", "seven", ""]) {
      const action = { capability: "widgets", action: "widget_add", etf: "BTBETRETF", definition: { periodAmount: raw } };
      const result = normaliseModelAction(action, context) as Record<string, unknown>;
      expect((result.definition as Record<string, unknown>).periodAmount).toBe(raw);
    }
  });

  it("NM-5: periodUnit words fold to days/reports, other words unchanged", () => {
    const context = buildContext();
    for (const [raw, expected] of [
      ["Days", "days"], ["day", "days"], ["DAY", "days"], [" days ", "days"],
      ["Report", "reports"], ["reports", "reports"], ["REPORTS", "reports"],
    ] as const) {
      const action = {
        capability: "widgets", action: "widget_add", etf: "BTBETRETF",
        definition: { periodUnit: raw }, changes: { periodUnit: raw }, match: { periodUnit: raw },
        definitions: [{ periodUnit: raw }],
      };
      const result = normaliseModelAction(action, context) as Record<string, unknown>;
      expect((result.definition as Record<string, unknown>).periodUnit).toBe(expected);
      expect((result.changes as Record<string, unknown>).periodUnit).toBe(expected);
      expect((result.match as Record<string, unknown>).periodUnit).toBe(expected);
      expect(((result.definitions as Record<string, unknown>[])[0]!).periodUnit).toBe(expected);
    }
    for (const raw of ["weeks", "zile"]) {
      const action = { capability: "widgets", action: "widget_add", etf: "BTBETRETF", definition: { periodUnit: raw } };
      const result = normaliseModelAction(action, context) as Record<string, unknown>;
      expect((result.definition as Record<string, unknown>).periodUnit).toBe(raw);
    }
  });

  it("NM-6: operation synonyms, every case/separator variant, fold to the canonical operation", () => {
    const context = buildContext();
    for (const [operation, synonyms] of Object.entries(OPERATION_SYNONYMS)) {
      for (const synonym of synonyms) {
        for (const variant of [synonym, synonym.toUpperCase(), synonym.replace(/_/g, " "), synonym.replace(/_/g, "-")]) {
          const action = {
            capability: "widgets", action: "widget_add", etf: "BTBETRETF",
            definition: { operation: variant }, changes: { operation: variant }, match: { operation: variant },
            definitions: [{ operation: variant }],
          };
          const result = normaliseModelAction(action, context) as Record<string, unknown>;
          expect((result.definition as Record<string, unknown>).operation, `${variant} -> ${operation}`).toBe(operation);
          expect((result.changes as Record<string, unknown>).operation).toBe(operation);
          expect((result.match as Record<string, unknown>).operation).toBe(operation);
          expect(((result.definitions as Record<string, unknown>[])[0]!).operation).toBe(operation);
        }
      }
    }
    const unknown = { capability: "widgets", action: "widget_add", etf: "BTBETRETF", definition: { operation: "median" } };
    const result = normaliseModelAction(unknown, context) as Record<string, unknown>;
    expect((result.definition as Record<string, unknown>).operation).toBe("median");
  });

  it("NM-7: field name variants (EN label, RO label, RO without diacritics, upper key, key with spaces, spaced/cased label) resolve to the key", () => {
    const context = buildContext();
    const variants = [
      "Units in circulation",
      "Unități de fond în circulație",
      "Unitati de fond in circulatie",
      "UNITS_IN_CIRCULATION",
      "units in circulation",
    ];
    for (const value of variants) {
      const action = { capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: value };
      expect(normaliseModelAction(action, context)).toEqual({
        capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "units_in_circulation",
      });
    }
    const spaced = { capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "  net ASSET " };
    expect(normaliseModelAction(spaced, context)).toEqual({
      capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "net_asset",
    });
    const exact = { capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "net_asset" };
    expect(normaliseModelAction(exact, context)).toEqual(exact);
  });

  it("NM-8: unknown field names and ambiguous labels stay unknown", () => {
    const context = buildContext();
    for (const value of ["VUAN", "share price", "not_catalogued"]) {
      const action = { capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: value };
      expect(normaliseModelAction(action, context)).toEqual(action);
    }
    const ambiguous: ConfigurationContext = {
      etfs: [{
        symbol: "X", name: "X", isActive: true,
        available: [
          { fieldKey: "key_one", labelRo: "Aceeași etichetă", labelEn: "Same label" },
          { fieldKey: "key_two", labelRo: "Aceeași etichetă", labelEn: "Same label" },
        ],
        tracked: [],
      }],
    };
    const action = { capability: "configuration", action: "track_field", symbol: "X", field: "Same label" };
    expect(normaliseModelAction(action, ambiguous)).toEqual(action);
  });

  it("NM-9: valid input of every action type (plus match, slot:'all' and * variants) is left unchanged", () => {
    const context = buildContext();
    const examples: unknown[] = [
      { capability: "configuration", action: "add_etf", symbol: "XYZETF", name: null },
      { capability: "configuration", action: "remove_etf", symbol: "BTBETRETF" },
      { capability: "configuration", action: "track_field", symbol: "*", field: "net_asset" },
      { capability: "configuration", action: "untrack_field", symbol: "BTBETRETF", field: "net_asset" },
      { capability: "widgets", action: "widget_add", etf: "*", definition: { operation: "max", fieldKey: "net_asset", periodUnit: "days", periodAmount: 7 } },
      { capability: "widgets", action: "widget_update", etf: "BTBETRETF", slot: 1, changes: { operation: "min" } },
      { capability: "widgets", action: "widget_update", etf: "BTBETRETF", match: { operation: "min" }, changes: { periodAmount: 10 } },
      { capability: "widgets", action: "widget_clear", etf: "BTBETRETF", slot: "all" },
      { capability: "widgets", action: "widget_clear", etf: "BTBETRETF", match: { fieldKey: "net_asset" } },
      { capability: "widgets", action: "widget_replace", etf: "BTBETRETF", definitions: [{ operation: "change", fieldKey: "net_asset", periodUnit: "reports", periodAmount: 5 }] },
    ];
    for (const example of examples) {
      expect(normaliseModelAction(example, context)).toEqual(example);
    }
  });

  it("NM-10: invalid input still fails strictly, with the same closed reason, after normalisation", () => {
    const context = buildContext();
    const widgets = widgetContextFor(context);

    const invalidWidget = { capability: "widgets", action: "widget_add", etf: "BTBETRETF", definition: { operation: "median", fieldKey: "net_asset", periodUnit: "days", periodAmount: 7 } };
    const rawResult = validateWidgetAction(invalidWidget, widgets);
    const normalisedResult = validateWidgetAction(normaliseModelAction(invalidWidget, context), widgets);
    expect(rawResult).toEqual({ ok: false, reason: "unknown_operation" });
    expect(normalisedResult).toEqual(rawResult);

    const badPeriodUnit = { capability: "widgets", action: "widget_add", etf: "BTBETRETF", definition: { operation: "max", fieldKey: "net_asset", periodUnit: "weeks", periodAmount: 7 } };
    expect(validateWidgetAction(normaliseModelAction(badPeriodUnit, context), widgets)).toEqual(validateWidgetAction(badPeriodUnit, widgets));

    for (const amount of ["7.5", "0", "400"]) {
      const bad = { capability: "widgets", action: "widget_add", etf: "BTBETRETF", definition: { operation: "max", fieldKey: "net_asset", periodUnit: "days", periodAmount: amount } };
      expect(validateWidgetAction(normaliseModelAction(bad, context), widgets)).toEqual(validateWidgetAction(bad, widgets));
    }

    const badField = { capability: "configuration", action: "track_field", symbol: "BTBETRETF", field: "share price" };
    const parsedRaw = parseConfigurationAction(badField);
    const groundedRaw = groundAction(parsedRaw, "track share price for BTBETRETF", context);
    const normalisedField = normaliseModelAction(badField, context);
    const parsedNorm = parseConfigurationAction(normalisedField);
    const groundedNorm = groundAction(parsedNorm, "track share price for BTBETRETF", context);
    expect(groundedRaw).toEqual({ kind: "unclear", reason: "unknown_field" });
    expect(groundedNorm).toEqual(groundedRaw);

    const extraKey = { capability: "widgets", action: "widget_add", etf: "BTBETRETF", definition: {}, extra: "x" };
    expect(validateWidgetAction(normaliseModelAction(extraKey, context), widgets)).toEqual(validateWidgetAction(extraKey, widgets));

    const badTitle = { capability: "widgets", action: "widget_add", etf: "BTBETRETF", definition: { operation: "max", fieldKey: "net_asset", periodUnit: "days", periodAmount: 7, title: null } };
    expect(validateWidgetAction(normaliseModelAction(badTitle, context), widgets)).toEqual(validateWidgetAction(badTitle, widgets));
  });

  it("NM-11: never touches capability, action, name, title, or the etf/symbol value", () => {
    const context = buildContext();
    for (const action of [
      { capability: "configuration", action: "ADD_ETF", symbol: "X" },
      { capability: "Widgets", action: "widget_add", etf: "X", definition: {} },
      { capability: "widgets", action: "widget_delete", etf: "X" },
    ]) {
      expect(normaliseModelAction(action, context)).toEqual(action);
    }
    const withTitleAndName = { capability: "configuration", action: "add_etf", symbol: "X", name: "Some Name" };
    expect(normaliseModelAction(withTitleAndName, context)).toEqual(withTitleAndName);
  });

  it("NM-12: never adds/removes a key other than the rename, never throws on odd input", () => {
    const context = buildContext();
    const cases: unknown[] = [
      null, "x", [], 5,
      { capability: "widgets", action: "widget_add", etf: "X", definition: null },
      { capability: "widgets", action: "widget_update", etf: "X", match: [] },
      { capability: "widgets", action: "widget_replace", etf: "X", definitions: "x" },
      { capability: "widgets", action: "widget_update", etf: "X", changes: 5 },
      { capability: "configuration", action: "track_field", symbol: "X", field: 42 },
      { capability: "widgets", action: "widget_replace", etf: "X", definitions: [null, 3] },
    ];
    for (const value of cases) {
      expect(() => normaliseModelAction(value, context)).not.toThrow();
    }
    const renamed = { capability: "widgets", action: "widget_add", symbol: "X", definition: {} };
    const after = normaliseModelAction(renamed, context) as Record<string, unknown>;
    expect(Object.keys(after).sort()).toEqual(["action", "capability", "definition", "etf"].sort());
  });

  it("NM-13: pure — never mutates the input, and is idempotent", () => {
    const context = buildContext();
    const cases: unknown[] = [
      { capability: "widgets", action: "widget_add", symbol: "*", definition: { operation: "Maximum", fieldKey: "Units in circulation", periodUnit: "Days", periodAmount: "7" } },
      { capability: "configuration", action: "track_field", etf: "BTBETRETF", field: "Net asset" },
      { capability: "widgets", action: "widget_update", etf: "BTBETRETF", match: { operation: "minimum", periodAmount: " 30 " }, changes: { periodUnit: "REPORTS" } },
      { capability: "widgets", action: "widget_replace", etf: "BTBETRETF", definitions: [{ operation: "avg", fieldKey: "net_asset" }] },
      null,
      5,
    ];
    for (const value of cases) {
      const frozen = typeof value === "object" && value !== null ? deepFreeze(structuredClone(value)) : value;
      const once = normaliseModelAction(frozen, context);
      expect(frozen).toEqual(typeof value === "object" && value !== null ? deepFreeze(structuredClone(value)) : value);
      const twice = normaliseModelAction(once, context);
      expect(twice).toEqual(once);
    }
  });
});

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
