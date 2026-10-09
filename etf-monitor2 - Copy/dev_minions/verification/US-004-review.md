# US-004 review — Bilingual (RO/EN) infrastructure and language switcher

## Round 1 — 2026-09-23

Verdict: PASS

Reviewer: story-reviewer subagent (independent context; did not write this code). Read
`AGENTS.md`, `dev_minions/backlog/stories/US-004.md`, `dev_minions/verification/US-004-plan.md`,
FR8.1 (`dev_minions/requirements/etf-monitoring-requirements.md`), and every file listed under
"Files changed" for US-004 in `dev_minions/HANDOVER.md`. Ran `pnpm typecheck`, `pnpm lint`,
`env -u DATABASE_URL pnpm test`, and `env -u DATABASE_URL pnpm build` myself (all green — see
Verification commands below), plus a local `pnpm start` smoke check (not required by the plan,
done anyway since it needed no live/production resource). No git command was run.

### Acceptance criteria

- **AC1 — the app renders in Romanian by default.** MET.
  `i18n/request.ts:5-9` resolves the locale from the `NEXT_LOCALE` cookie via
  `resolveLocale` (`i18n/locale.ts:10-12`), which falls back to `defaultLocale = "ro"`
  for anything absent or invalid. Proven by `i18n/request.test.ts:24-32` (no cookie →
  `locale: "ro"`, `messages` deep-equals `ro.json`) and `i18n/locale.test.ts:19-25`.
  Also confirmed live: after `pnpm build` + `pnpm start -p 3100`, `curl -s localhost:3100/`
  returned `<html lang="ro" ...>` and the body contained "Monitorizare ETF BVB".
- **AC2 — the switcher changes all visible labels between RO and EN.** MET.
  `components/LanguageSwitcher.tsx` renders one submit button per locale from
  `i18n/locale.ts`'s `locales` list, posting to the server action `setLocale`
  (`i18n/actions.ts:8-19`), which sets the `NEXT_LOCALE` cookie only for a valid
  locale value (`i18n/actions.test.ts` — 5 tests, covers valid, invalid string,
  missing field, non-string `FormData` value). `i18n/request.test.ts` proves the
  cookie value round-trips into the correct locale + messages on the next request.
  `components/AppHeader.test.tsx` and `app/page.test.tsx` render the real components
  under both locales via `NextIntlClientProvider` + `renderToStaticMarkup`, asserting
  the visible text equals the catalogue values and that each locale's render never
  contains the other locale's differing text. `components/LanguageSwitcher.test.tsx`
  asserts the current locale's button is `disabled`/`aria-current="true"` and the other
  is neither. The one piece not covered by an automated test is an actual browser
  click (there is no client JS handler to test — the switcher is a plain HTML form,
  progressive-enhancement only), which the plan defers to the QA checklist. Given the
  full request cycle (button value → server action → cookie → request config →
  rendered output) is unit-tested end to end, I accept this as sufficiently proven by
  tests, not as an unjustified MANUAL-QA carve-out.
  Live check: `curl -H "Cookie: NEXT_LOCALE=en" localhost:3100/` returned
  `<html lang="en" ...>` and "BVB ETF Monitoring".
- **AC3 — the selected locale survives a full page reload.** MET.
  The cookie set by `setLocale` uses `path: "/"` and `maxAge: 31536000` (one year,
  not a session cookie) — asserted in `i18n/actions.test.ts:18-22` — and
  `i18n/request.ts` reads that cookie on every request (server-side, not
  localStorage, per task 3). Live curl check above shows the `en` cookie is honoured
  on a fresh, independent request.
- **AC4 — `ro.json`/`en.json` have identical key structures.** MET.
  `i18n/messages.test.ts:22-25` asserts `collectKeyPaths(ro)` deep-equals
  `collectKeyPaths(en)` (recursive, sorted dotted paths, `i18n/keys.ts:3-14`), and a
  second test asserts every leaf in both catalogues is a non-empty string (guards
  against a key that exists but is blank).
- **AC5 — a unit test fails if a key exists in only one catalogue.** MET.
  `i18n/messages.test.ts:35-65` clones the real `ro`/`en` objects in memory, adds a
  probe key at top level and nested under `Nav`, and asserts `findKeyMismatches`
  reports it correctly and `assertSameKeys` (the function the AC4 parity test uses)
  throws naming the probe key, in both directions. This exercises the exact function
  the real parity test depends on, so the real test provably goes red on drift. The
  plan explains why it uses `structuredClone` instead of literally editing the
  on-disk JSON (deferred to the QA checklist as a one-time human demonstration); I
  agree that's reasonable — editing and reverting fixture files inside a unit test is
  not standard practice, and the in-memory version proves the same code path.
- **AC6 — no hard-coded user-facing strings in any component added by this story.**
  MET. `eslint.config.mjs:16-26` adds `react/jsx-no-literals` for `app/**/*.tsx` and
  `components/**/*.tsx` (excluding `*.test.tsx`), and `pnpm lint` passes clean, so no
  hard-coded JSX text node exists. I additionally grepped every non-test `.tsx` file
  under `app/` and `components/` (`app/layout.tsx`, `app/page.tsx`,
  `components/AppHeader.tsx`, `components/LanguageSwitcher.tsx` — the only four) for
  string-valued props a user can see (`title`, `aria-label`, `alt`, `placeholder`,
  metadata) since the lint rule (`ignoreProps: true`) does not catch those: the only
  one present is `aria-label={t("label")}` in `LanguageSwitcher.tsx:10`, which is
  translated, not hard-coded. `generateMetadata` in `app/layout.tsx:18-24` uses
  `getTranslations("Metadata")`. `global.d.ts` types `AppConfig.Messages` against
  `ro.json` so `pnpm typecheck` fails on an unknown key (confirmed clean).
- **AC7 — `pnpm test`, `pnpm lint`, `pnpm build` all pass.** MET. Ran all three
  myself: `pnpm typecheck` clean, `pnpm lint` clean, `env -u DATABASE_URL pnpm test`
  → 10 files / 45 tests passed, `env -u DATABASE_URL pnpm build` → compiled
  successfully, route `/` is dynamic (`ƒ`) as expected from reading the locale
  cookie in the request config.
- **Task 5 (README convention)** — MET. `README.md`'s "Internationalisation" section
  (added by this story) documents: add every key to both catalogues, the parity
  test, server vs. client translation APIs, the lint rule and what it does not
  catch, typed keys, the cookie-only locale source, DB-sourced `label_ro`/`label_en`
  being out of scope, and that number formatting is DEC-007/a later story.

### Findings (ordered by severity)

1. (Warning) `i18n/request.ts:5-9` returns `{ locale, messages }` without a
   `timeZone`. Every component test that calls `useTranslations` prints an
   `IntlError: ENVIRONMENT_FALLBACK — There is no timeZone configured` warning to
   stderr (visible in `pnpm test` output, tests still pass). Harmless today because
   nothing in this story formats a date/time, but worth setting a global default
   (e.g. `Europe/Bucharest`) before any story that does, both to silence the noise
   and to avoid a real markup mismatch across environments per next-intl's own
   warning. Not blocking for US-004 since no AC touches dates.
2. (Note) HANDOVER.md's "Files changed" lists `pnpm-workspace.yaml` as edited for
   this story, but its only content (`allowBuilds`, `minimumReleaseAgeExclude`) shows
   no next-intl-related entries — matching the plan's expectation that an entry
   would only be needed "if install fails" (it didn't). I could not verify via git
   whether this file's content actually changed for US-004 (agents don't run git).
   Not a defect in the story's code either way; flagging only for HANDOVER accuracy,
   for the tech-lead's audit.

### Scope deviations

None found. The dependency set is unchanged except `next-intl` (per ADR-001,
justified by the story). No jsdom/@testing-library was added, matching the plan's
explicit constraint. The `Health.*` and `Nav.admin`/`Nav.health` catalogue keys are
seeded-but-unused; this is called out explicitly by the story's own task 2 ("seed
them with the keys needed so far... the health-check page strings that US-006 will
use") and the plan's "Decisions needed" section — not undisclosed scope creep.

### Verification commands (run by the reviewer)

```
pnpm typecheck                                    → clean
pnpm lint                                          → clean
env -u DATABASE_URL pnpm test                      → 10 files, 45 tests passed
env -u DATABASE_URL pnpm build                     → success, "/" dynamic (ƒ)
pnpm start -p 3100 + curl (no cookie)              → <html lang="ro">, "Monitorizare ETF BVB"
pnpm start -p 3100 + curl -H "Cookie: NEXT_LOCALE=en" → <html lang="en">, "BVB ETF Monitoring"
```

No git command was run at any point during this review.
