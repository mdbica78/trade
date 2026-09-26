import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDateTime } from "./datetime";

describe("DT: formatDateTime — Europe/Bucharest, 24-hour", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("DT-1: summer (UTC+3)", () => {
    expect(formatDateTime("2026-09-22T10:03:00Z", "en")).toBe("2026-09-22 13:03");
    expect(formatDateTime("2026-09-22T10:03:00Z", "ro")).toBe("22.09.2026 13:03");
  });

  it("DT-2: winter (UTC+2)", () => {
    expect(formatDateTime("2026-01-15T10:03:00Z", "en")).toBe("2026-01-15 12:03");
    expect(formatDateTime("2026-01-15T10:03:00Z", "ro")).toBe("15.01.2026 12:03");
  });

  it("DT-3: DST start 2026-03-29", () => {
    expect(formatDateTime("2026-03-29T00:59:00Z", "en")).toBe("2026-03-29 02:59");
    expect(formatDateTime("2026-03-29T01:00:00Z", "en")).toBe("2026-03-29 04:00");
  });

  it("DT-4: DST end 2026-10-25", () => {
    expect(formatDateTime("2026-10-25T00:59:00Z", "en")).toBe("2026-10-25 03:59");
    expect(formatDateTime("2026-10-25T01:00:00Z", "en")).toBe("2026-10-25 03:00");
  });

  it("DT-5: midnight crossing never shows hour 24", () => {
    expect(formatDateTime("2026-09-22T21:30:00Z", "en")).toBe("2026-09-23 00:30");
  });

  it("DT-6: an offset input is normalised", () => {
    expect(formatDateTime("2026-09-22T13:03:00+03:00", "en")).toBe("2026-09-22 13:03");
  });

  it("DT-7: independent of the process time zone", () => {
    for (const tz of ["America/Los_Angeles", "Pacific/Kiritimati"]) {
      vi.stubEnv("TZ", tz);
      expect(formatDateTime("2026-09-22T10:03:00Z", "en")).toBe("2026-09-22 13:03");
      expect(formatDateTime("2026-09-22T10:03:00Z", "ro")).toBe("22.09.2026 13:03");
      expect(formatDateTime("2026-01-15T10:03:00Z", "en")).toBe("2026-01-15 12:03");
      expect(formatDateTime("2026-03-29T00:59:00Z", "en")).toBe("2026-03-29 02:59");
      expect(formatDateTime("2026-09-22T21:30:00Z", "en")).toBe("2026-09-23 00:30");
    }
  });

  it("DT-8: a non-date string is returned verbatim, never throws", () => {
    expect(formatDateTime("not a date", "en")).toBe("not a date");
  });
});
