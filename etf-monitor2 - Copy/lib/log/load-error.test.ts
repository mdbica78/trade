import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { describeLoadError, logLoadError } from "./load-error";

const SENTINEL = "postgres://user:SENTINELPW@host/db";

describe("describeLoadError (AC1)", () => {
  it("LE-1: Drizzle-style wrapper — outer name kept, inner code/relation surfaced", () => {
    const driver = Object.assign(new Error(`relation "etf_report_links" does not exist ${SENTINEL}`), {
      name: "NeonDbError",
      code: "42P01",
    });
    const outer = new Error(`Failed query: select … params: ${SENTINEL}`, { cause: driver });
    outer.name = "DrizzleQueryError";

    const described = describeLoadError(outer);
    expect(described).toEqual({ name: "DrizzleQueryError", code: "42P01", relation: "etf_report_links" });
    expect(Object.keys(described).sort()).toEqual(["code", "name", "relation"]);
  });

  it("LE-3: invalid codes are dropped", () => {
    for (const code of ["4201", "42p01", "ECONNREFUSED", 42601, "42P01 ", "42P01;x"]) {
      const error = Object.assign(new Error("x"), { code });
      const described = describeLoadError(error);
      expect(described.code).toBeUndefined();
      expect(Object.keys(described)).not.toContain("code");
    }
  });

  it("LE-4: invalid relations are dropped", () => {
    const cases: unknown[] = [
      Object.assign(new Error("x"), { table: "etf report" }),
      Object.assign(new Error("x"), { table: "etf\"x" }),
      Object.assign(new Error("x"), { table: "public.etfs" }),
      Object.assign(new Error("x"), { table: "Etfs" }),
      new Error('relation "public.etf_report_links" does not exist'),
      new Error('relation "a b" does not exist'),
    ];
    for (const error of cases) {
      const described = describeLoadError(error);
      expect(described.relation).toBeUndefined();
      expect(Object.keys(described)).not.toContain("relation");
    }
  });

  it("LE-5: a valid `table` field wins over the message; falls back to the message pattern", () => {
    const withTable = Object.assign(new Error('relation "wrong_one" does not exist'), { table: "etf_report_links" });
    expect(describeLoadError(withTable).relation).toBe("etf_report_links");

    const withMessageOnly = new Error('relation "etf_report_links" does not exist');
    expect(describeLoadError(withMessageOnly).relation).toBe("etf_report_links");
  });

  it("LE-6: cause walk — 3rd cause level reported, 4th level not", () => {
    const level4 = { code: "42601" };
    const level3 = { code: "42P01", cause: level4 };
    const level2 = { cause: level3 };
    const level1 = { cause: level2 };
    const top = Object.assign(new Error("x"), { cause: level1 });
    expect(describeLoadError(top).code).toBe("42P01");

    const onlyLevel4 = { cause: { cause: { cause: { cause: { code: "42601" } } } } };
    const top2 = Object.assign(new Error("x"), onlyLevel4);
    expect(describeLoadError(top2).code).toBeUndefined();
  });

  it("LE-6b: a cyclic cause terminates", () => {
    const e = new Error("x") as Error & { cause?: unknown };
    e.cause = e;
    expect(() => describeLoadError(e)).not.toThrow();
  });

  it("LE-7: non-Error / unsafe names fall back to Unknown", () => {
    expect(describeLoadError(SENTINEL)).toEqual({ name: "Unknown" });
    expect(describeLoadError(null)).toEqual({ name: "Unknown" });
    expect(describeLoadError(undefined)).toEqual({ name: "Unknown" });
    expect(describeLoadError({})).toEqual({ name: "Unknown" });

    const badName = new Error("x");
    badName.name = "Bad Name://x";
    expect(describeLoadError(badName)).toEqual({ name: "Unknown" });

    class MissingDatabaseUrlError extends Error {
      constructor() {
        super("x");
        this.name = "MissingDatabaseUrlError";
      }
    }
    expect(describeLoadError(new MissingDatabaseUrlError())).toEqual({ name: "MissingDatabaseUrlError" });
  });

  it("LE-8: never throws even when code/cause/message getters throw", () => {
    const hostile = {};
    Object.defineProperty(hostile, "code", {
      get() {
        throw new Error("boom");
      },
    });
    Object.defineProperty(hostile, "cause", {
      get() {
        throw new Error("boom");
      },
    });
    Object.defineProperty(hostile, "message", {
      get() {
        throw new Error("boom");
      },
    });
    Object.defineProperty(hostile, "name", {
      get() {
        throw new Error("boom");
      },
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => logLoadError("home", hostile)).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatch(/^\[load-error\] /);
    spy.mockRestore();
  });
});

describe("logLoadError (AC1)", () => {
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    spy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    spy.mockRestore();
  });

  it("LE-2: prints exactly one safe line with no secret fragments", () => {
    const driver = Object.assign(new Error(`relation "etf_report_links" does not exist ${SENTINEL}`), {
      name: "NeonDbError",
      code: "42P01",
    });
    const outer = new Error(`Failed query: select … params: ${SENTINEL}`, { cause: driver });
    outer.name = "DrizzleQueryError";

    logLoadError("home", outer);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]).toHaveLength(1);
    const line = spy.mock.calls[0][0] as string;
    expect(line).toBe("[load-error] home name=DrizzleQueryError code=42P01 relation=etf_report_links");
    for (const forbidden of ["SENTINELPW", "://", "does not exist", "Failed query", "\n", "    at "]) {
      expect(line).not.toContain(forbidden);
    }
  });

  it("LE-9: DATABASE_URL never read from the environment", () => {
    vi.stubEnv("DATABASE_URL", SENTINEL);
    logLoadError("home", new Error(`x ${SENTINEL}`));
    expect(spy.mock.calls[0][0]).not.toContain("SENTINELPW");
    vi.unstubAllEnvs();
  });

  it("LE-10: an unsafe scope is sanitised to 'unknown'", () => {
    logLoadError("Bad scope://x", new Error("x"));
    expect(spy.mock.calls[0][0]).toMatch(/^\[load-error\] unknown /);
  });
});
