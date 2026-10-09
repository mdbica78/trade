import type { ChatReplyState, TranscriptEntry } from "./chat-state";

export function appendTranscript(prev: readonly TranscriptEntry[], message: string, reply: ChatReplyState): TranscriptEntry[] {
  return [...prev, { id: prev.length, message, reply }];
}
