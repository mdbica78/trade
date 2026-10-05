import { parseReportNumber } from "./numbers";
import { findLabel, findUniqueReportDate, labelSource, toExtractionResult, tokenAfter, tokenWindowEnd } from "./text";
import type { ExtractionAdapter, ExtractionResult } from "./types";

export const BRD_DEPOSITARY_KEY = "brd-depositary";

export const BRD_FIELD_KEYS = [
  "net_asset",
  "units_in_circulation",
  "units_held_individuals",
  "units_held_legal_entities",
  "nav_per_unit",
  "investors_total",
  "investors_individuals",
  "investors_legal_entities",
] as const;

const LABELS = {
  netAsset: "ACTIV NET (in valuta fond - RON)",
  units: "NUMAR U.F. in circulatie, din care detinute de:",
  personsIndividual: "Persoane fizice",
  personsLegal: "Persoane juridice",
  investors: "Numar investitori, din care:",
  vuan: "VALOARE UNITARA A ACTIVULUI NET (VUAN)",
  footer: "Raport depozitar la data de",
} as const;

/**
 * Sub-search bound (AC8, Sprint 2 audit N3): a block is its total, then two `label (2 tokens) +
 * value` pairs — 7 whitespace tokens. Bounding the units/investors sub-searches to this window
 * stops a sub-field from ever borrowing a value from a later, unrelated block.
 */
const BRD_BLOCK_TOKENS = 7;

function numberAfterLabel(
  text: string,
  label: string,
  from = 0,
  to: number = text.length,
): { value: { numericValue: string; rawValue: string }; end: number } | null {
  const label_ = findLabel(text, label, from, to);
  if (!label_) {
    return null;
  }
  const tok = tokenAfter(text, label_.end, to);
  if (!tok) {
    return null;
  }
  const value = parseReportNumber(tok.token);
  if (!value) {
    return null;
  }
  return { value, end: tok.end };
}

function findReportDate(text: string): { reportDate: string } | { error: string } {
  const footerRe = new RegExp(labelSource(LABELS.footer), "g");
  return findUniqueReportDate(text, footerRe, {
    occurrence: "footer",
    missing: "report date not found (footer phrase missing)",
  });
}

function extract(text: string): ExtractionResult {
  const dateResult = findReportDate(text);
  if ("error" in dateResult) {
    return { ok: false, error: dateResult.error };
  }

  const results = new Map<string, { numericValue: string; rawValue: string }>();

  const netAsset = numberAfterLabel(text, LABELS.netAsset);
  if (netAsset) results.set("net_asset", netAsset.value);

  const units = findLabel(text, LABELS.units);
  let unitsEnd: number | undefined;
  if (units) {
    unitsEnd = units.end;
    const unitsValue = tokenAfter(text, units.end);
    if (unitsValue) {
      const parsed = parseReportNumber(unitsValue.token);
      if (parsed) results.set("units_in_circulation", parsed);
    }
  }

  const investorsLabel = findLabel(text, LABELS.investors);

  let legalEntitiesEnd: number | undefined;
  if (units && unitsEnd !== undefined) {
    // AC8: never search past the investors label, and never past this block's own window either.
    const windowEnd = tokenWindowEnd(text, unitsEnd, BRD_BLOCK_TOKENS);
    const regionEnd =
      investorsLabel && investorsLabel.start >= unitsEnd
        ? Math.min(investorsLabel.start, windowEnd)
        : windowEnd;
    const individuals = numberAfterLabel(text, LABELS.personsIndividual, unitsEnd, regionEnd);
    if (individuals) results.set("units_held_individuals", individuals.value);

    const legal = numberAfterLabel(text, LABELS.personsLegal, unitsEnd, regionEnd);
    if (legal) {
      results.set("units_held_legal_entities", legal.value);
      legalEntitiesEnd = legal.end;
    }
  }

  // nav_per_unit: FINDINGS trap 1 — the value precedes its label (VUAN).
  const vuanLabel = findLabel(text, LABELS.vuan);
  if (vuanLabel && legalEntitiesEnd !== undefined && investorsLabel && investorsLabel.start >= legalEntitiesEnd) {
    const gap = text
      .slice(legalEntitiesEnd, investorsLabel.start)
      .split(/\s+/)
      .filter(Boolean);
    if (gap.length === 1) {
      const parsed = parseReportNumber(gap[0]);
      if (parsed) results.set("nav_per_unit", parsed);
    }
  }

  if (investorsLabel) {
    const investorsEnd = investorsLabel.end;
    // AC8: bound the investors sub-searches to this block's own window too.
    const investorsWindowEnd = tokenWindowEnd(text, investorsEnd, BRD_BLOCK_TOKENS);
    const total = tokenAfter(text, investorsEnd, investorsWindowEnd);
    if (total) {
      const parsed = parseReportNumber(total.token);
      if (parsed) results.set("investors_total", parsed);
    }
    const individuals = numberAfterLabel(text, LABELS.personsIndividual, investorsEnd, investorsWindowEnd);
    if (individuals) results.set("investors_individuals", individuals.value);
    const legal = numberAfterLabel(text, LABELS.personsLegal, investorsEnd, investorsWindowEnd);
    if (legal) results.set("investors_legal_entities", legal.value);
  }

  return toExtractionResult(dateResult.reportDate, BRD_FIELD_KEYS, results);
}

function canHandle(text: string): boolean {
  return (
    findLabel(text, LABELS.footer) !== null &&
    findLabel(text, "NUMAR U.F. in circulatie") !== null &&
    findLabel(text, LABELS.vuan) !== null
  );
}

export const brdDepositaryAdapter: ExtractionAdapter = {
  key: BRD_DEPOSITARY_KEY,
  fieldKeys: BRD_FIELD_KEYS,
  canHandle,
  extract,
};
