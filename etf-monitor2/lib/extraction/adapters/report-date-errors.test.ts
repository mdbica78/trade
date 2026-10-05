import { describe, expect, it } from "vitest";
import { brdDepositaryAdapter } from "./brd-depositary";
import { intercapitalNavAdapter } from "./intercapital-nav";

/**
 * Pins the exact report-date error strings both adapters produce (US-049 AC3), before the A4
 * refactor shares the date-finding loop between them. Both adapters' `extract` returns the date
 * error first, so each case needs only the date-finding phrase, not a full report body.
 */

describe("brdDepositaryAdapter report-date errors (AE-1..5)", () => {
  it("AE-1: footer phrase missing", () => {
    const result = brdDepositaryAdapter.extract("no footer phrase here at all");
    expect(result).toEqual({ ok: false, error: "report date not found (footer phrase missing)" });
  });

  it("AE-2: footer occurrence with no token after it", () => {
    const result = brdDepositaryAdapter.extract("Raport depozitar la data de");
    expect(result).toEqual({ ok: false, error: "report date not found after footer occurrence 1" });
  });

  it("AE-3: invalid calendar date (31.02.2026)", () => {
    const result = brdDepositaryAdapter.extract("Raport depozitar la data de 31.02.2026");
    expect(result).toEqual({ ok: false, error: 'invalid report date "31.02.2026"' });
  });

  it("AE-4: token not shaped like a dotted date (2026-09-22)", () => {
    const result = brdDepositaryAdapter.extract("Raport depozitar la data de 2026-09-22");
    expect(result).toEqual({ ok: false, error: 'invalid report date "2026-09-22"' });
  });

  it("AE-5: conflicting report dates across two footer occurrences", () => {
    const text =
      "Raport depozitar la data de 22.09.2026 some text Raport depozitar la data de 23.09.2026";
    const result = brdDepositaryAdapter.extract(text);
    expect(result).toEqual({ ok: false, error: "conflicting report dates: 2026-09-22, 2026-09-23" });
  });
});

describe("intercapitalNavAdapter report-date errors (AE-6..10)", () => {
  it('AE-6: "Data:" label missing', () => {
    const result = intercapitalNavAdapter.extract("no data label here at all");
    expect(result).toEqual({ ok: false, error: 'report date not found ("Data:" label missing)' });
  });

  it('AE-7: "Data:" occurrence with no token after it', () => {
    const result = intercapitalNavAdapter.extract("Data:");
    expect(result).toEqual({ ok: false, error: 'report date not found after "Data:" occurrence 1' });
  });

  it("AE-8: invalid calendar date (31.02.2026)", () => {
    const result = intercapitalNavAdapter.extract("Data: 31.02.2026");
    expect(result).toEqual({ ok: false, error: 'invalid report date "31.02.2026"' });
  });

  it("AE-9: token not shaped like a dotted date (2026-09-22)", () => {
    const result = intercapitalNavAdapter.extract("Data: 2026-09-22");
    expect(result).toEqual({ ok: false, error: 'invalid report date "2026-09-22"' });
  });

  it('AE-10: conflicting report dates across two "Data:" occurrences', () => {
    const text = "Data: 22.09.2026 some text Data: 23.09.2026";
    const result = intercapitalNavAdapter.extract(text);
    expect(result).toEqual({ ok: false, error: "conflicting report dates: 2026-09-22, 2026-09-23" });
  });
});
