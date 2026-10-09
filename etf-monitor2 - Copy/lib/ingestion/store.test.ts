import { drizzle } from "drizzle-orm/neon-http";
import { describe, expect, it } from "vitest";
import * as schema from "../db/schema";
import type { Db } from "../db/index";
import { buildFindReportStatement, buildSaveReportStatements, rowsOf } from "./store";

const mockDb = drizzle.mock({ schema }) as unknown as Db;

const baseInput = {
  etfId: 1,
  reportDate: "2026-09-22",
  sourceUrl: "https://bvb.ro/example.pdf",
  fetchedAt: new Date("2026-09-22T09:00:00Z"),
  status: "ok" as const,
  errorMessage: null,
  values: [
    { fieldKey: "units_in_circulation", numericValue: "37520000", rawValue: "37,520,000" },
    { fieldKey: "nav_per_unit", numericValue: "11.171", rawValue: "11.171" },
  ],
};

describe("buildSaveReportStatements", () => {
  it("returns 2 + N + 1 statements for N values", () => {
    const statements = buildSaveReportStatements(mockDb, baseInput);
    expect(statements).toHaveLength(2 + baseInput.values.length + 1);
  });

  it("the first statement claims the row with an interim non-ok status, guarded by status <> 'ok'", () => {
    const [claim] = buildSaveReportStatements(mockDb, baseInput);
    const { sql, params } = claim.getQuery();
    expect(sql).toContain('insert into "reports"');
    expect(sql).toContain('on conflict ("etf_id", "report_date") do update set');
    expect(sql.toLowerCase()).toContain('"status" <> ');
    expect(sql).toContain("'parse_error'");
    expect(sql).not.toMatch(/=\s*'ok'/);
    expect(params).not.toContain("ok");
  });

  it("each value statement inserts via a subquery on (etf_id, report_date), guarded by status <> 'ok'", () => {
    const statements = buildSaveReportStatements(mockDb, baseInput);
    const valueStatements = statements.slice(2, 2 + baseInput.values.length);
    for (const statement of valueStatements) {
      const { sql } = statement.getQuery();
      expect(sql).toContain('insert into "report_values"');
      expect(sql).toContain("select");
      expect(sql).toContain('from "reports"');
      expect(sql).toContain('"etf_id" = ');
      expect(sql).toContain('"report_date" = ');
      expect(sql.toLowerCase()).toContain('"status" <> ');
    }
  });

  it("the last statement sets status only after the values, guarded and returning id", () => {
    const statements = buildSaveReportStatements(mockDb, baseInput);
    const last = statements[statements.length - 1];
    const { sql, params } = last.getQuery();
    expect(sql).toContain('update "reports"');
    expect(sql).toContain('returning "id"');
    expect(sql.toLowerCase()).toContain('"status" <> ');
    expect(params[0]).toBe("ok");
  });

  it("no statement except the last has 'ok' as a set value", () => {
    const statements = buildSaveReportStatements(mockDb, baseInput);
    for (const statement of statements.slice(0, -1)) {
      const { params } = statement.getQuery();
      expect(params).not.toContain("ok");
    }
  });

  it("de-duplicates to one statement per value (zero values -> only the report statements)", () => {
    const statements = buildSaveReportStatements(mockDb, { ...baseInput, values: [] });
    expect(statements).toHaveLength(3);
  });
});

describe("SQ-14b: the status <> 'ok' guard also applies to a parse_error write (US-014 AC7)", () => {
  it("every statement's SQL contains the literal status <> 'ok' guard", () => {
    const parseErrorInput = { ...baseInput, status: "parse_error" as const, errorMessage: "missing fields: nav_per_unit" };
    const statements = buildSaveReportStatements(mockDb, parseErrorInput);
    for (const statement of statements) {
      const { sql } = statement.getQuery();
      expect(sql).toContain(`"status" <> 'ok'`);
    }
  });

  it("the last statement's status parameter is 'parse_error', never silently coerced to 'ok'", () => {
    const parseErrorInput = { ...baseInput, status: "parse_error" as const, errorMessage: "missing fields: nav_per_unit" };
    const statements = buildSaveReportStatements(mockDb, parseErrorInput);
    const { params } = statements[statements.length - 1].getQuery();
    expect(params[0]).toBe("parse_error");
  });
});

describe("buildFindReportStatement", () => {
  it("selects id and status filtered by etf_id and report_date", () => {
    const { sql } = buildFindReportStatement(mockDb, 1, "2026-09-22").getQuery();
    expect(sql).toContain('select "id", "status"');
    expect(sql).toContain('from "reports"');
  });
});

describe("rowsOf", () => {
  it("returns an array result as-is", () => {
    expect(rowsOf([{ id: 1 }])).toEqual([{ id: 1 }]);
  });
  it("unwraps a .rows result", () => {
    expect(rowsOf({ rows: [{ id: 1 }] })).toEqual([{ id: 1 }]);
  });
  it("returns [] for anything else", () => {
    expect(rowsOf(undefined)).toEqual([]);
    expect(rowsOf(null)).toEqual([]);
    expect(rowsOf({})).toEqual([]);
  });
});
