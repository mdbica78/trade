import type { ChatPlanState, ChatReplyState, TranscriptEntry } from "./chat-state";
import { isConfirmAnswer, pendingPlanToken } from "./confirm";

export const NEW_CONVERSATION_INTENT = "new";
export const CONFIRM_INTENT = "confirm";
export const CANCEL_INTENT = "cancel";
export const CANCELLED_MEMO = "[cancelled by the user: nothing done]";
export const DISCARDED_MEMO_SUFFIX = " [not confirmed: nothing done]";

export function appendTranscript(
  prev: readonly TranscriptEntry[],
  message: string,
  reply: ChatReplyState,
  hiddenKeyRequestLabel = "",
): TranscriptEntry[] {
  return [...prev, {
    id: prev.length,
    message: reply.messageKey === "keyRequest" ? hiddenKeyRequestLabel : message,
    reply,
  }];
}

export type HistoryMessage = { role: "user" | "assistant"; content: string };

/** Rebuilds the provider-side history from the visible transcript: user text as shown, assistant = `memo`. */
export function historyFromTranscript(entries: readonly TranscriptEntry[], max?: number): HistoryMessage[] {
  const history: HistoryMessage[] = [];
  for (const entry of entries) {
    history.push({ role: "user", content: entry.message });
    if (entry.reply.memo !== undefined && entry.reply.memo !== "") {
      history.push({ role: "assistant", content: entry.reply.memo });
    }
  }
  return max === undefined ? history : history.slice(-max);
}

export type ConfirmOption = {
  action: (formData: FormData) => Promise<ChatReplyState>;
  confirmLabel: string;
  cancelLabel: string;
};

/** Replaces the last entry's `plan` status, dropping the token; optionally appends to its memo (discard only). */
function markPendingPlan(
  entries: readonly TranscriptEntry[],
  status: Exclude<ChatPlanState["status"], "pending">,
  memoSuffix = "",
): TranscriptEntry[] {
  if (entries.length === 0) return [...entries];
  const last = entries[entries.length - 1]!;
  const updatedReply: ChatReplyState = {
    ...last.reply,
    ...(last.reply.plan === undefined ? {} : { plan: { status } }),
    ...(memoSuffix === "" ? {} : { memo: `${last.reply.memo ?? ""}${memoSuffix}` }),
  };
  return [...entries.slice(0, -1), { ...last, reply: updatedReply }];
}

/**
 * The `useActionState` reducer for the chat form. `intent === "new"` resets the transcript
 * without calling the server action (US-055 AC4 "New conversation"). With a pending plan (US-058
 * req. 1, T-15) and a `confirm` option wired in: Confirm (the button, or a typed "yes"-shaped
 * answer) sends only the token to `confirm.action`; Cancel discards it with no server call; any
 * other message discards the plan (marking its memo so the model sees it did not run) and sends
 * normally. Without the `confirm` parameter, or with no pending plan, behaviour is unchanged.
 */
export async function chatTurn(
  prev: readonly TranscriptEntry[],
  formData: FormData,
  action: (formData: FormData) => Promise<ChatReplyState>,
  hiddenKeyRequestLabel: string,
  historyMessages?: number,
  confirm?: ConfirmOption,
): Promise<TranscriptEntry[]> {
  if (formData.get("intent") === NEW_CONVERSATION_INTENT) {
    return [];
  }

  const pendingToken = confirm === undefined ? null : pendingPlanToken(prev);
  if (confirm !== undefined && pendingToken !== null) {
    const intent = formData.get("intent");
    const typedMessage = String(formData.get("message") ?? "");

    if (intent === CANCEL_INTENT) {
      const withoutPending = markPendingPlan(prev, "cancelled");
      return appendTranscript(withoutPending, confirm.cancelLabel, {
        tone: "info",
        messageKey: "planCancelled",
        memo: CANCELLED_MEMO,
      });
    }

    if (intent === CONFIRM_INTENT || isConfirmAnswer(typedMessage)) {
      const confirmFormData = new FormData();
      confirmFormData.set("token", pendingToken);
      const reply = await confirm.action(confirmFormData);
      const withoutPending = markPendingPlan(prev, "confirmed");
      const label = intent === CONFIRM_INTENT ? confirm.confirmLabel : typedMessage;
      return appendTranscript(withoutPending, label, reply, hiddenKeyRequestLabel);
    }

    const discarded = markPendingPlan(prev, "discarded", DISCARDED_MEMO_SUFFIX);
    formData.set("history", JSON.stringify(historyFromTranscript(discarded, historyMessages)));
    const reply = await action(formData);
    return appendTranscript(discarded, typedMessage, reply, hiddenKeyRequestLabel);
  }

  const message = String(formData.get("message") ?? "");
  formData.set("history", JSON.stringify(historyFromTranscript(prev, historyMessages)));
  const reply = await action(formData);
  return appendTranscript(prev, message, reply, hiddenKeyRequestLabel);
}
