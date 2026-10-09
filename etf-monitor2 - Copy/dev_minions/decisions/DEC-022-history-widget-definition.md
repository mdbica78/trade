# DEC-022 — History widget definition and multi-action chat (FR18)

Status: **Decided** (Technical Lead chat, 2026-09-28) for every technical point. Three product items ship isolated defaults (last section).
Amends: DEC-017 §5 (capabilities; one action per message becomes up to five). Builds on DEC-016 (config writes), DEC-019 (optional tables), DEC-010/`delta.ts` (exact decimals).
Input: FR18 (requirements §8). Scope of change: Sprint 11 US-043..US-045 (US-046, the raw-field spike, is not built here).

## Context
The user wants to say, in the chat, "show in history the change between today and one week ago", have it saved, and see it on the ETF
detail page until they update, clear or replace it. The model must produce a **structured definition from a closed set**, never code.
Also today a message with two requests ("add X and turn field Y on") is refused (`{kind:"multiple"}` in `configuration/intent.ts`).

## Decision
1. **The definition (closed set).** One widget is exactly:
   - `operation`: `change` | `percent_change` | `average` | `min` | `max`
   - `fieldKey`: an existing field key of that ETF's adapter catalogue (`field_catalog`) whose values are numeric
   - `periodUnit`: `days` | `reports`, and `periodAmount`: integer 1–365
   - `title`: optional text, at most 60 characters, shown as plain text (React escapes it). Absent → generated from operation, field label and period, in the page's language.
   Nothing else: no expression, formula, code, URL or free-form field. Unknown keys in model output are rejected, not ignored.
2. **Meaning (deterministic, pure, no I/O in the engine).** "Latest" is the newest `ok` report of the ETF, never the calendar today. For `days`, the
   window is `[latest date − amount, latest date]`; for `reports`, the latest `amount` `ok` reports.
   `change` = latest value − the value of the newest `ok` report on or before `latest date − amount days` (for `reports`: the report `amount` reports earlier);
   `percent_change` = the same over that earlier value; `average`, `min`, `max` run over the window's values of the field. A field missing in a report is skipped, not
   counted as 0. If the earlier value is absent, or the window holds no values, the result is `insufficient_history` (a message, never 0); a zero divisor gives no percent (as DEC-007/P7).
   Arithmetic reuses the exact bigint decimal helpers of `lib/monitoring/delta.ts` (no floats); percent uses the shipped P7 rounding (2 decimals, half away from zero). Average rounds half away from zero to 4 decimals (isolated default) and is shown with the standard number format (DEC-007).
   The result carries its basis (the two report dates used) so the page can show it.
3. **Storage.** New table `etf_widgets` in its own migration: `id serial pk`, `etf_id` → `etfs` on delete cascade, `slot smallint not null` (1–6), `operation`, `field_key`, `period_unit`, `period_amount`, `title`, `updated_at`,
   `unique (etf_id, slot)`, `check` constraints on `operation`, `period_unit`, `slot between 1 and 6`, `period_amount between 1 and 365`. Columns, not JSON, so the database also enforces the closed set.
   `MAX_WIDGETS_PER_ETF = 6`, the number of slots. The slot is what the user and the chat call "the first widget". Widgets are per ETF (global widgets are not built).
4. **Validation.** One function `validateWidgetDefinition(input, catalogue)` in `lib/config/widgets.ts` is the only gate; the chat and any form call it. It checks
   the closed set, the amount range, the title length, and that the field belongs to the ETF's adapter catalogue and is numeric. It returns a closed error code (`unknown_operation`, `unknown_field`,
   `bad_period`, `bad_title`, `bad_slot`, `unknown_etf`, `too_many`) and never throws on model output.
5. **Writes (DEC-016).** Plain functions over `Db` + `BatchRunner` in `lib/config/widgets.ts`: `addWidget` (first free slot; `too_many` when full), `updateWidget` (slot; supplied fields replace, the rest stay), `clearWidget` (slot, or all of one ETF),
   `replaceWidgets` (all widgets of one ETF replaced by a new list, in **one batch**, so the area is never half-replaced). Actions and chat call these; they contain no SQL of their own.
6. **Chat capability.** New folder `lib/ai/capabilities/widgets/` with one registry entry (DEC-017 §5). It offers four actions: `widget_add {etf, definition}`, `widget_update {etf, slot, changes}`,
   `widget_clear {etf, slot | "all"}`, `widget_replace {etf, definitions[]}`. The model is asked for JSON only; the reply is parsed and validated with §4 before anything is written. The model never sees other users' data and receives only the ETF symbols
   and the field catalogue labels it needs. Model text is never executed and never shown as HTML.
7. **Several actions in one message (all capabilities).** The intent step returns a list `actions[]` (1 to `MAX_ACTIONS_PER_MESSAGE = 5`), each tagged with its capability and action, replacing the `{kind:"multiple"}` refusal.
   Order: (a) parse and validate **every** action against the current state first; if any is invalid, nothing is executed and the reply names the invalid one; (b) execute in order, each through its `lib/config` function;
   (c) on a runtime failure, stop, and report per action `done` / `failed` / `not run`. There is no rollback across actions (each write is atomic on its own; `widget_replace` is atomic inside itself). The reply lists what was done.
   More than five actions gets a fixed refusal asking the user to split the message. `US-045` owns the exact types; the constraints above bind.
8. **Display.** The ETF detail page gets a "Custom values" area above the history table: per widget its title, its value (with sign and arrow for changes) and its basis dates. Widgets are optional (DEC-019): a missing
   `etf_widgets` table (42P01) or a query error hides the area, logs one sanitised `[load-error]` line and never fails the page. An `insufficient_history` widget shows a short message in the page's language.
9. **Not here.** No new raw fields read from a report label (FR19, spike US-046: decide, do not build); no widgets on the home table; no operations beyond the five; no model-written code, ever.

## Product items (isolated defaults, no story blocked)
- **PW-1** Widgets belong to one ETF each, at most 6 per ETF. Default shipped; if you want global widgets or a different limit, say so (one constant and one migration change).
- **PW-2** Average is rounded to 4 decimals. Default shipped.
- **PW-3** "Today" always means the newest stored report, shown with its date. Default shipped.

## Consequences
- US-043 (Sprint 11) = this DEC's schema, validator and config functions with tests; US-044 = engine and rendering; US-045 = capability plus multi-action for every capability (the configuration capability's four actions become usable in lists too).
- Tests are deterministic: table-driven engine cases (weekend gaps, missing field, zero divisor, `reports` vs `days`), validator rejects, chat multi-action ordering and validate-all-first, no network.
- The new table's migration is applied by the production deploy (DEC-023); no user step. The page works without the table meanwhile.
