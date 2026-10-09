import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import ro from "../messages/ro.json";
import { assertSameKeys, collectKeyPaths, findKeyMismatches } from "./keys";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function allLeaves(obj: Record<string, unknown>): unknown[] {
  const leaves: unknown[] = [];
  for (const value of Object.values(obj)) {
    if (isPlainObject(value)) {
      leaves.push(...allLeaves(value));
    } else {
      leaves.push(value);
    }
  }
  return leaves;
}

describe("message catalogues have identical keys", () => {
  it("ro.json and en.json have the same set of dotted key paths", () => {
    expect(collectKeyPaths(ro)).toEqual(collectKeyPaths(en));
  });

  it("every leaf value in both catalogues is a non-empty string", () => {
    for (const leaf of [...allLeaves(ro), ...allLeaves(en)]) {
      expect(typeof leaf).toBe("string");
      expect((leaf as string).length).toBeGreaterThan(0);
    }
  });
});

describe("drift is detected", () => {
  it("a key added only to a clone of ro is reported as onlyInA and fails assertSameKeys", () => {
    const roClone = structuredClone(ro) as typeof ro & {
      __drift_probe__?: string;
      Nav: typeof ro.Nav & { __drift_probe__?: string };
    };
    roClone.__drift_probe__ = "x";
    roClone.Nav.__drift_probe__ = "x";

    const { onlyInA, onlyInB } = findKeyMismatches(roClone, en);
    expect(onlyInA).toEqual(["Nav.__drift_probe__", "__drift_probe__"]);
    expect(onlyInB).toEqual([]);

    expect(() => assertSameKeys(roClone, en)).toThrow(/__drift_probe__/);
  });

  it("the same probe added to a clone of en is reported as onlyInB", () => {
    const enClone = structuredClone(en) as typeof en & {
      __drift_probe__?: string;
      Nav: typeof en.Nav & { __drift_probe__?: string };
    };
    enClone.__drift_probe__ = "x";
    enClone.Nav.__drift_probe__ = "x";

    const { onlyInA, onlyInB } = findKeyMismatches(ro, enClone);
    expect(onlyInA).toEqual([]);
    expect(onlyInB).toEqual(["Nav.__drift_probe__", "__drift_probe__"]);

    expect(() => assertSameKeys(ro, enClone)).toThrow(/__drift_probe__/);
  });
});
