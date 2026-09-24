import { parseReportNumber } from "./numbers";
import type { ExtractedValue, ExtractionAdapter, ExtractionResult } from "./types";
import { isIsoCalendarDate } from "./validate";

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

/** Escapes regex metacharacters in one label word (R2). */
function escapeWord(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Splits a label on whitespace, escapes each word, and rejoins with \s+ (tolerates runs of whitespace, R2). */
function labelSource(label: string): string {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeWord)
    .join("\\s+");
}

type Span = { start: number; end: number };

/** First match of `label` lying entirely inside text.slice(from, to). No module-level regex (R1). */
function findLabel(text: string, label: string, from = 0, to: number = text.length): Span | null {
  const slice = text.slice(from, to);
  const match = new RegExp(labelSource(label)).exec(slice);
  if (!match) {
    return null;
  }
  return { start: from + match.index, end: from + match.index + match[0].length };
}

/** Skips whitespace from pos, then takes the maximal run of non-whitespace inside [pos, to). */
function tokenAfter(text: string, pos: number, to: number = text.length): { token: string; end: number } | null {
  let i = pos;
  while (i < to && /\s/.test(text[i])) {
    i += 1;
  }
  const start = i;
  while (i < to && !/\s/.test(text[i])) {
    i += 1;
  }
  if (i === start) {
    return null;
  }
  return { token: text.slice(start, i), end: i };
}

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

const FOOTER_DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

function findReportDate(text: string): { reportDate: string } | { error: string } {
  const footerRe = new RegExp(labelSource(LABELS.footer), "g");
  const dates = new Set<string>();
  let match: RegExpExecArray | null;
  let found = 0;

  while ((match = footerRe.exec(text)) !== null) {
    found += 1;
    const tok = tokenAfter(text, match.index + match[0].length);
    if (!tok) {
      return { error: `report date not found after footer occurrence ${found}` };
    }
    const dateMatch = FOOTER_DATE_RE.exec(tok.token);
    if (!dateMatch) {
      return { error: `invalid report date "${tok.token}"` };
    }
    const [, dd, mm, yyyy] = dateMatch;
    const iso = `${yyyy}-${mm}-${dd}`;
    if (!isIsoCalendarDate(iso)) {
      return { error: `invalid report date "${tok.token}"` };
    }
    dates.add(iso);
  }

  if (found === 0) {
    return { error: "report date not found (footer phrase missing)" };
  }
  if (dates.size > 1) {
    return { error: `conflicting report dates: ${[...dates].join(", ")}` };
  }
  return { reportDate: [...dates][0] };
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
    const regionEnd =
      investorsLabel && investorsLabel.start >= unitsEnd ? investorsLabel.start : text.length;
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
    const total = tokenAfter(text, investorsEnd);
    if (total) {
      const parsed = parseReportNumber(total.token);
      if (parsed) results.set("investors_total", parsed);
    }
    const individuals = numberAfterLabel(text, LABELS.personsIndividual, investorsEnd);
    if (individuals) results.set("investors_individuals", individuals.value);
    const legal = numberAfterLabel(text, LABELS.personsLegal, investorsEnd);
    if (legal) results.set("investors_legal_entities", legal.value);
  }

  const values: ExtractedValue[] = [];
  const missingFields: string[] = [];
  for (const fieldKey of BRD_FIELD_KEYS) {
    const found = results.get(fieldKey);
    if (found) {
      values.push({ fieldKey, numericValue: found.numericValue, rawValue: found.rawValue });
    } else {
      missingFields.push(fieldKey);
    }
  }

  return { ok: true, reportDate: dateResult.reportDate, values, missingFields };
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
