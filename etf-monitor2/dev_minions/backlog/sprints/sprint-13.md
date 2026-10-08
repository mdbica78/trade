# Sprint 13 — A smarter chat assistant and more AI providers

> Detailed and reviewed by the Technical Lead chat, 2026-10-05. Decisions: DEC-025 (chat understanding), DEC-026 (providers).
> **PO review 2026-10-05 (with the user) — see "PO review" below. It changes the build order, re-scopes US-055, adds US-058
> and changes product defaults. Where this file and DEC-025 differ on a product default, this file wins** (DEC-025 marks
> those values "default, can be changed by the user without a new decision"). No user step.

## Why
The user's transcript (2026-10-05): "clear units in circulation for all etf" → "Action 2 is invalid"; "add max value for units in circulation for last 7 days" → "I could not tell exactly what to change"; "clear max value … for last month for all etf" → same; only "add … for all etf" worked. Root causes are in DEC-025: the model never sees existing custom values or tracked fields, there is no "all ETFs", the symbol must literally appear in the message for configuration actions, follow-ups have no history, and all replies are fixed templates. The user also cannot add providers beyond Gemini and Groq (DEC-026).

The user's complaint to the PO, same day: *"The AI is very dumb, no natural language, I can't have a proper conversation with it; it is not intelligent enough to turn my natural language into instructions for the app."* The goal of this sprint is therefore an **assistant**, not only a better parser: it turns plain RO/EN requests into app instructions, talks back in natural language, asks when something is unclear, and confirms before big changes.

## Stories — build in this order (sequential; they share `lib/ai`)
| # | Story | Title | Decision |
|---|---|---|---|
| 1 | US-053 | Chat sees the current state; "all ETFs"; clear/update by description | DEC-025 §1-§4 |
| 2 | US-054 | Better prompt and tolerant normalisation for small models | DEC-025 §6-§7 |
| 3 | US-056 | More provider presets, stronger model suggestions, test connection | DEC-026 §1, §3, §4 |
| 4 | US-057 | Custom OpenAI-compatible provider with a URL-bound key | DEC-026 §2 |
| 5 | US-055 | **Conversational assistant:** natural replies, 21-message memory, clarifying dialogue, questions about the setup, explained results | DEC-025 §5 + **DEC-027** |
| 6 | US-058 | **Assistant reliability:** confirm before big changes, one self-correction round, structured output where the provider supports it | **DEC-027** |

Why this order (PO): US-053/054 are the foundation every later story uses. The two provider stories are fully decided and
give the user stronger models and "Test connection" early. US-055 and US-058 need DEC-027 (below) and benefit from both.

## PO review (2026-10-05)

### Product defaults — final values (user, via PO)
| Topic | DEC-025/026 default | Final |
|---|---|---|
| "All ETFs" / no ETF named | all active ETFs | **Every ETF saved in the app whose status is active.** Deactivated ETFs are never included. Same meaning, now explicit and tested (US-053 AC7). |
| Chat memory | 6 turns | **The last 21 messages** of the visible conversation (user and assistant messages counted one by one). Each remembered message may be shortened to a per-message cap the Technical Lead sets, so requests stay inside free-tier token limits; the count of 21 is not reduced. |
| Provider presets | DEC-026 §1 | **Confirmed:** Gemini, Groq, OpenAI, OpenRouter, Mistral, DeepSeek, Cerebras, Together AI. |
| Custom providers | max 5 | **Confirmed:** up to 5 of your own OpenAI-compatible providers (name + https address); the saved key is bound to the address and deleted if the address changes. |
| Test connection | DEC-026 §4 | **Confirmed.** |
| Period words | week 7 / month 30 / quarter 90 / year 365 days | Confirmed. |
| Length of one chat message | 500 characters (`CHAT_MESSAGE_MAX_LENGTH`) | **2000 characters** (US-055), so the user can write naturally. |
| Confirmation before big changes | — (not in DEC-025) | **New default (US-058):** ask before removing an ETF, stopping tracking of a field, or clearing/replacing custom values on more than one ETF. Adding things and single-ETF edits run at once. |

### Acceptance criteria
The agent-drafted acceptance criteria of US-053, US-054, US-056 and US-057 are **confirmed by the PO** (2026-10-05), with
one addition to US-053 (AC7, active ETFs only). US-055 is rewritten by the PO; US-058 is new.

### What the PO asks the Technical Lead to decide — DEC-027 "Conversational assistant"
DEC-025 §5 keeps the model's own words hidden (only a clarifying question may be shown). The user rejects that: replies
read like recorded phrases. The PO requirements are in US-055 and US-058; the Technical Lead decides **how**, in DEC-027,
which amends DEC-017 (sprint-06 decision 7, "no model prose shown") and DEC-025 §5. Points to settle:
1. **Model-written reply shown as plain text** (escaped, never HTML, never executed, length cap), and how the
   server-built result summary stays the single truth when the model's words and the real outcome differ.
2. **Response shape**: one structured answer per turn, e.g. `{reply, actions[], question?, needsConfirmation?}`, and
   whether to use the provider's native tool/function calling or JSON-schema output (OpenAI-compatible `tools` /
   `response_format`, Gemini `responseSchema`) with the current JSON-in-text as fallback.
3. **Self-correction round**: when strict validation rejects the model's actions, send the specific validation
   reasons back to the model once and validate again before answering the user. Cap on model calls per user message
   (PO suggests 2, at most 3) given free-tier rate limits.
4. **Confirmation without login or server sessions**: what runs after "yes" must be exactly the validated plan that was
   shown — not a fresh re-interpretation. E.g. a server-signed plan token (key derived like DEC-021) carried in the
   client transcript, with an expiry. Technical Lead's choice.
5. **History budget**: per-message cap and total size for the 21 remembered messages (free-tier TPM on Groq/Cerebras).
6. **Prompt-injection posture** now that model text is shown: data from the database (widget titles, ETF names) and
   remembered messages stay in data blocks; the reply can never contain a key; key-request refusal unchanged.

**DEC-027 is written** (Technical Lead chat, 2026-10-05: `decisions/DEC-027-conversational-assistant.md`); the fallback below no longer applies. If DEC-027 does not exist when US-055 starts, the in-loop `tech-lead` writes it (mode `decision DEC-027`) from these
points and the PO requirements in US-055/US-058 — the loop does not wait. The product choices in it are already made here.

## Decisions needed
None open for the user. Product defaults above (change any by telling the PO). DEC-027 is technical (Technical Lead chat,
or the in-loop `tech-lead` if it is not written first).

## Sprint audit
After US-058 the in-loop `tech-lead` writes `SPRINT-13-audit.md`, then the demo file. The demo file must include the
manual conversation script from US-055 "For the user" so the user can try the assistant on the live app.
