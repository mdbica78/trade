// Trivial helper to give the scaffold's test setup something real to run.
// The actual bilingual number-display component (DEC-007) belongs to a later story.
export function formatNumber(value: number): string {
  return value.toFixed(2);
}
