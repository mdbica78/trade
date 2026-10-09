import { describe, expect, it } from "vitest";
import { isNavActive } from "./header-nav";

describe("HN: isNavActive", () => {
  it("HN-1 / is active only for exactly /", () => {
    expect(isNavActive("/", "/")).toBe(true);
    expect(isNavActive("/", "/etf/BTBETRETF")).toBe(false);
    expect(isNavActive("/", "/admin")).toBe(false);
  });

  it("HN-2 any other href is active for itself and its sub-paths", () => {
    expect(isNavActive("/admin", "/admin")).toBe(true);
    expect(isNavActive("/admin", "/admin/cron")).toBe(true);
    expect(isNavActive("/admin", "/admin/etfs/BTBETRETF")).toBe(true);
  });

  it("HN-3 a prefix clash is not active", () => {
    expect(isNavActive("/admin", "/adminx")).toBe(false);
    expect(isNavActive("/chat", "/chatbot")).toBe(false);
  });

  it("HN-4 a null pathname makes nothing active", () => {
    expect(isNavActive("/", null)).toBe(false);
    expect(isNavActive("/admin", null)).toBe(false);
    expect(isNavActive("/admin", undefined)).toBe(false);
  });
});
