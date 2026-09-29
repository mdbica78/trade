import { formatFilingCounts, oneLine, type IngestOutcome } from "./outcome";

const NON_FAILURE_CODES = new Set(["ok", "already_ingested", "not_attempted"]);

/**
 * Combines the per-link outcomes of one filing into the single outcome the daily run records
 * for the ETF (US-037 AC1/AC3/AC4/AC5, D-2). `outcomes` are in processing order (newest link
 * first).
 */
export function combineFilingOutcomes(
  symbol: string,
  outcomes: readonly IngestOutcome[],
  truncated: boolean,
): IngestOutcome {
  if (outcomes.length === 0) {
    return { code: "internal_error", symbol, detail: oneLine("internal error: no report link") };
  }

  let stored = 0;
  let alreadyStored = 0;
  let failed = 0;
  let notAttempted = 0;
  for (const outcome of outcomes) {
    if (outcome.code === "ok") stored += 1;
    else if (outcome.code === "already_ingested") alreadyStored += 1;
    else if (outcome.code === "not_attempted") notAttempted += 1;
    else failed += 1;
  }
  const counts = formatFilingCounts({ stored, alreadyStored, failed, notAttempted, truncated });

  const firstFailure = outcomes.find((o) => !NON_FAILURE_CODES.has(o.code));
  if (firstFailure) {
    return { ...firstFailure, detail: oneLine(`${counts}; ${firstFailure.detail}`) };
  }

  if (notAttempted > 0) {
    return {
      code: "not_attempted",
      symbol,
      detail: oneLine(`${counts}; run time limit: remaining reports not downloaded before the deadline`),
    };
  }

  const okOutcomes = outcomes.filter(
    (o): o is Extract<IngestOutcome, { code: "ok" }> => o.code === "ok",
  );
  if (okOutcomes.length > 0) {
    let newest = okOutcomes[0];
    for (const outcome of okOutcomes.slice(1)) {
      if (outcome.reportDate > newest.reportDate) {
        newest = outcome;
      }
    }
    const valuesWritten = okOutcomes.reduce((sum, o) => sum + o.valuesWritten, 0);
    return {
      code: "ok",
      symbol,
      reportDate: newest.reportDate,
      sourceUrl: newest.sourceUrl,
      valuesWritten,
      detail: oneLine(`${counts}; ${valuesWritten} values written`),
    };
  }

  const first = outcomes[0];
  const reportDate = first.code === "already_ingested" ? first.reportDate : "";
  return { code: "already_ingested", symbol, reportDate, detail: oneLine(counts) };
}
