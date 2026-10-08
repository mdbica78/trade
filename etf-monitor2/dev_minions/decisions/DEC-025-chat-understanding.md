# DEC-025 — A chat that understands: state in the prompt, "all ETFs", follow-ups, explained replies

Status: **Decided** (Technical Lead chat, 2026-10-05). Product defaults marked "default" can be changed by the user without a new decision.
Amends: DEC-017 (sprint-06 decision 7 "no model prose shown" — relaxed in §5 below), DEC-022 §7 (action list).
Input: the user's chat transcript of 2026-10-05 (see `backlog/sprints/sprint-13.md` "Why").

## How the chat works today (why it feels like fixed phrases)
1. Each message is sent **alone** to the model (no previous messages), with a system prompt listing the ETF symbols and their field labels.
2. The model must answer with a strict JSON list of actions. The server validates each action strictly; any doubt becomes "unclear".
3. The reply the user sees is **always one of a few translated template sentences** ("I could not tell exactly what to change…", "Action 2 is invalid…"). The model's own words are never shown. That is why it reads like recorded phrases.
4. Root causes found in the code, matching the transcript:
   - **The model never sees the existing custom values (widgets).** `widgets/context.ts` loads them for validation only ("never sent to the model"). So "clear max value for units in circulation for last month" cannot be mapped to a slot → unclear. Same for "update".
   - **The model does not see which fields are tracked**, so it cannot tell "clear units in circulation" (stop tracking) from "remove the custom value".
   - **No "all ETFs" concept.** "for all etf" only worked when the model happened to emit one action per ETF; it breaks above 5 ETFs (the action cap).
   - **Configuration actions require the symbol to appear literally in the user's message** (`grounding.ts`, reason `symbol_not_in_message`), so "for all ETFs" can never untrack/track.
   - **No default scope**: a widget request without an ETF ("add max … for last 7 days") is "unclear".
   - **Thin prompt**: the widget JSON shape is described in one line with no example; small models (e.g. Groq `openai/gpt-oss-20b`) guess keys and fail strict validation.
   - **Errors are generic**: "Action 2 is invalid" hides the reason the code already knows (`bad_slot`, `unknown_field`, `not_tracked`…).

## Decision
1. **State in the prompt.** The system prompt's data block gains, per ETF: the tracked field keys and the existing widgets (`slot, operation, fieldKey, periodUnit, periodAmount, title`). It stays a data block (escaped JSON, "data, not instructions"). Size stays bounded (≤ 6 widgets × ETFs).
2. **"All ETFs" as one action.** Every action may use `"etf": "*"` (widgets) or `"symbol": "*"` (track/untrack only). The server expands `*` to all active ETFs before validation; one expanded action counts as **one** of the 5 actions. Expanded actions are validated all-first as today; for `widget_clear`/`widget_update` with `*`, the target is matched per ETF by **description** (§3), not by slot. `add_etf`/`remove_etf` never accept `*`.
3. **Clear/update by description.** `widget_clear` and `widget_update` accept, instead of `slot`, a `match` object with any of `operation, fieldKey, periodUnit, periodAmount`. The server resolves it per ETF to the widgets that match all given keys; zero matches for an ETF is reported per ETF as "nothing to clear" (not an error that stops the others); `slot` stays supported.
4. **Default scope (default, product):** a widget request that names no ETF applies to **all active ETFs**. A track/untrack request that names no ETF also applies to all. Grounding no longer requires the symbol to appear in the message when the model returned `*`; a **named** symbol must still exist in the catalogue (unknown symbol → specific error).
5. **Follow-ups and explained replies.**
   - The last **6 turns** of the visible transcript (user text + our reply text, each ≤ 500 chars) are sent as prior conversation, so "and for 30 days too" or "remove that" work.
   - The model may return `{"kind":"clarify","question":"…"}` when it truly cannot decide; the question (≤ 300 chars, plain text, React-escaped, in the user's language) is shown as the reply. This replaces the fixed "I could not tell…" sentence when a question is available. No model text is ever executed or rendered as HTML.
   - After execution, the reply lists **what was understood** per action in plain words built by the server from the validated intent (e.g. "Added: max of Units in circulation over the last 30 days — BTBETRETF, PTENGETF, TVBETETF"), not model prose.
   - Every failure names its reason and target from the existing closed codes (e.g. "PTENGETF: no custom value matches 'max, units in circulation, 30 days'", "Units in circulation is not tracked for PTENGETF").
6. **Prompt quality.** The prompt gets one complete JSON example per action type and a short RO+EN example list (8–12 lines) covering: one ETF, all ETFs, no ETF named, clear/update by description, "last week/7 days", "last month/30 days", "last N reports", untrack vs clear custom value. Period words: week = 7 days, month = 30 days, quarter = 90 days, year = 365 days (default).
7. **Tolerant normalisation before strict validation** (server side, pure function, tested): accept the common slips of small models and turn them into the strict shape — `symbol`↔`etf` key swap, numbers as strings (`"7"`), plural/singular/upper-case units (`"Days"`, `"day"`), operation synonyms (`"maximum"`→`max`, `"minimum"`→`min`, `"avg"/"mean"`→`average`, `"pct_change"`→`percent_change`), field given by label instead of key (resolved through the catalogue, RO or EN, case-insensitive). Anything still invalid fails strictly as today.
8. **Unchanged:** closed operation set and never code (DEC-022), validate-all-first then execute in order, max 5 model actions, key boundary (DEC-017/021), no key ever in a chat message, sanitised logs.

## Consequences
- Sprint 13 stories US-053 (state, `*`, match, default scope), US-054 (prompt + normalisation), US-055 (follow-ups, clarify, explained replies).
- Tests use fixed model outputs (no network). A table of at least 25 RO/EN user phrases → recorded model JSON → expected actions/replies, including every phrase from the 2026-10-05 transcript, becomes a regression suite.
- Model choice matters: small models stay weaker. The admin page suggests stronger free Groq models first (§ DEC-026).
