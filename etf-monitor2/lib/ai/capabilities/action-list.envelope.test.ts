import { describe, expect, it } from "vitest";
import { cutAtWord, parseActionListOutput, QUESTION_MAX_CHARS, REPLY_MAX_CHARS } from "./action-list";

const add = (symbol: string) => ({ capability: "configuration", action: "add_etf", symbol, name: null });

describe("envelope parsing (ENV, US-055 DEC-027 §2)", () => {
  it("ENV-1: reply + actions -> actions with the reply attached", () => {
    const out = parseActionListOutput(JSON.stringify({ reply: "I'll add it.", actions: [add("X")] }));
    expect(out).toEqual({ kind: "actions", actions: [add("X")], reply: "I'll add it." });
  });

  it("ENV-2: reply only (no actions key) -> answer with no question", () => {
    const out = parseActionListOutput(JSON.stringify({ reply: "The active ETFs are X and Y." }));
    expect(out).toEqual({ kind: "answer", reply: "The active ETFs are X and Y.", question: null });
  });

  it("ENV-3: question only -> answer with a null reply", () => {
    const out = parseActionListOutput(JSON.stringify({ question: "Which field?" }));
    expect(out).toEqual({ kind: "answer", reply: null, question: "Which field?" });
  });

  it("ENV-4: question + actions -> answer, actions are dropped (nothing runs while a question is open)", () => {
    const out = parseActionListOutput(JSON.stringify({ question: "Which field?", actions: [add("X")], reply: "Hmm." }));
    expect(out).toEqual({ kind: "answer", reply: "Hmm.", question: "Which field?" });
  });

  it("ENV-5a: legacy {\"actions\":[...]} with no reply key keeps today's exact shape (no reply field at all)", () => {
    const out = parseActionListOutput(JSON.stringify({ actions: [add("X")] }));
    expect(out).toEqual({ kind: "actions", actions: [add("X")] });
    expect("reply" in out).toBe(false);
  });

  it("ENV-5b: legacy single-key kinds are unchanged", () => {
    expect(parseActionListOutput('{"kind":"unsupported"}')).toEqual({ kind: "unsupported" });
    expect(parseActionListOutput('{"kind":"unclear"}')).toEqual({ kind: "unclear", reason: "model_unclear" });
    expect(parseActionListOutput('{"kind":"too_many"}')).toEqual({ kind: "too_many" });
  });

  it("ENV-6: an extra key, a non-string reply, or actions not an array is malformed", () => {
    for (const text of [
      JSON.stringify({ reply: "x", actions: [], unexpected: true }),
      JSON.stringify({ reply: 42, actions: [] }),
      JSON.stringify({ question: 42 }),
      JSON.stringify({ reply: "x", actions: "not-an-array" }),
    ]) {
      expect(parseActionListOutput(text)).toEqual({ kind: "unclear", reason: "malformed" });
    }
  });

  it('ENV-7: {"reply":"","actions":[]} (empty reply, no question, no actions) is malformed', () => {
    expect(parseActionListOutput(JSON.stringify({ reply: "", actions: [] }))).toEqual({ kind: "unclear", reason: "malformed" });
    expect(parseActionListOutput(JSON.stringify({ reply: "   ", actions: [], question: null }))).toEqual({
      kind: "unclear",
      reason: "malformed",
    });
  });

  it("ENV-8: a reply over 600 chars is cut to <= 600, ending with an ellipsis at a word boundary", () => {
    const long = "word ".repeat(140).trim(); // 699 chars
    const out = parseActionListOutput(JSON.stringify({ reply: long, actions: [] }));
    expect(out.kind).toBe("answer");
    if (out.kind !== "answer") return;
    expect(out.reply).not.toBeNull();
    expect(out.reply!.length).toBeLessThanOrEqual(REPLY_MAX_CHARS);
    expect(out.reply!.endsWith("…")).toBe(true);
    expect(out.reply).not.toMatch(/\s…$/);
  });

  it("ENV-9: a question over 300 chars is cut to <= 300", () => {
    const long = "word ".repeat(70).trim(); // 349 chars
    const out = parseActionListOutput(JSON.stringify({ question: long }));
    expect(out.kind).toBe("answer");
    if (out.kind !== "answer") return;
    expect(out.question!.length).toBeLessThanOrEqual(QUESTION_MAX_CHARS);
    expect(out.question!.endsWith("…")).toBe(true);
  });

  it("ENV-10: more than 5 actions with a reply is too_many (the reply is discarded)", () => {
    const six = Array.from({ length: 6 }, (_, i) => add(`ETF${i}`));
    expect(parseActionListOutput(JSON.stringify({ reply: "Doing a lot.", actions: six }))).toEqual({ kind: "too_many" });
  });
});

describe("cutAtWord", () => {
  it("returns the text unchanged when within the limit", () => {
    expect(cutAtWord("short text", 100)).toBe("short text");
  });

  it("cuts at the last whitespace before the limit when one exists past the halfway point", () => {
    const text = "aaaaaaaaaa bbbbbbbbbb cccccccccc";
    const cut = cutAtWord(text, 25);
    expect(cut.length).toBeLessThanOrEqual(25);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut).not.toMatch(/\s…$/);
  });

  it("cuts mid-word with no trailing space when no whitespace lies past the halfway point", () => {
    const text = "a".repeat(50);
    const cut = cutAtWord(text, 10);
    expect(cut).toBe(`${"a".repeat(9)}…`);
  });

  it("trims trailing whitespace before appending the ellipsis", () => {
    const text = `${"a".repeat(20)}   ${"b".repeat(20)}`;
    const cut = cutAtWord(text, 24);
    expect(cut.endsWith(" …")).toBe(false);
  });
});
