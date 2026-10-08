import type { TranscriptEntry } from "./chat-state";

/** D-2 (isolated default): typed answers that confirm a pending plan. The Confirm button always works regardless of this list. */
export const CONFIRM_WORDS: readonly string[] = ["da", "yes", "ok", "confirm", "confirma", "sigur", "go", "go ahead"];

function fold(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.!]+$/, "");
}

/** Exact match only (after folding): a longer sentence that happens to contain a confirm word does not count. */
export function isConfirmAnswer(text: string): boolean {
  return CONFIRM_WORDS.includes(fold(text));
}

/** The last transcript entry's pending plan token, or `null` if there is none to confirm. */
export function pendingPlanToken(entries: readonly TranscriptEntry[]): string | null {
  const last = entries[entries.length - 1];
  if (last === undefined) return null;
  const plan = last.reply.plan;
  if (plan === undefined || plan.status !== "pending" || plan.token === undefined) return null;
  return plan.token;
}
