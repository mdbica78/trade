# US-004 test verdict

## Round 1 — 2026-09-23

Verdict: PASS

### Command exit codes

| Command | Exit code | Status |
|---------|-----------|--------|
| `pnpm install --frozen-lockfile` | 0 | PASS |
| `pnpm typecheck` | 0 | PASS |
| `pnpm lint` | 0 | PASS |
| `pnpm test` (45 tests run) | 0 | PASS |
| `pnpm build` | 0 | PASS |

### Acceptance criteria to test mapping

| AC | Criterion | Test coverage |
|----|-----------|---|
| AC1 | The app renders in Romanian by default | `i18n/locale.test.ts` › locale › resolveLocale falls back to the default for anything invalid ✓ / `i18n/request.test.ts` › i18n request config › defaults to ro when there is no cookie ✓ |
| AC2 | The language switcher changes all visible labels between RO and EN | `components/LanguageSwitcher.test.tsx` › LanguageSwitcher › renders a form with RO and EN buttons for locale ro ✓ / renders a form with RO and EN buttons for locale en ✓ / marks the current locale's button as disabled and aria-current ✓ / `components/AppHeader.test.tsx` › AppHeader › renders the app name and the home nav label for locale ro ✓ / renders the app name and the home nav label for locale en ✓ / ro and en renders never contain the other locale's differing text ✓ / `app/page.test.tsx` › Home page › renders the app name and intro text for locale ro ✓ / renders the app name and intro text for locale en ✓ / ro and en renders never contain the other locale's differing text ✓ |
| AC3 | The selected locale survives a full page reload | `i18n/actions.test.ts` › setLocale › sets the NEXT_LOCALE cookie for a valid locale ✓ / does not set a cookie for an invalid locale ✓ / does not set a cookie and does not throw when the field is missing ✓ / does not set a cookie for a non-string value ✓ / `i18n/request.test.ts` › i18n request config › uses en when the cookie says en ✓ / falls back to ro for an invalid cookie value ✓ |
| AC4 | `messages/ro.json` and `messages/en.json` have identical key structures | `i18n/messages.test.ts` › message catalogues have identical keys › ro.json and en.json have the same set of dotted key paths ✓ / every leaf value in both catalogues is a non-empty string ✓ |
| AC5 | A unit test fails if a key exists in one catalogue but not the other — verify by temporarily adding a key and observing the failure | `i18n/messages.test.ts` › drift is detected › a key added only to a clone of ro is reported as onlyInA and fails assertSameKeys ✓ / the same probe added to a clone of en is reported as onlyInB ✓ |
| AC6 | No hard-coded user-facing strings remain in any component added by this story | Covered by `pnpm lint` (eslint `react/jsx-no-literals`) ✓ and `pnpm typecheck` (typed `AppConfig.Messages`) ✓ |
| AC7 | `pnpm test`, `pnpm lint`, and `pnpm build` all pass | All three commands exit 0 ✓ |
| Task 5 | `README.md` documents the "no hard-coded strings" convention | README.md "Internationalisation" section verified; covers key structure parity, server/client component patterns, lint guard, typed keys, cookie locale source, database labels, number formatting deferred ✓ |

### Notes

- All 45 tests passed (i18n: 17 tests, components: 6 tests, app: 3 tests, lib: 19 tests from prior stories).
- Two stderr warnings from next-intl about missing `timeZone` configuration are informational only and do not affect test outcomes; this is expected for test environments.
- Browser click-through on the language switcher and the "temporarily add a key" on-disk validation are marked `MANUAL-QA` in the plan and will be verified during user QA.
- No missing script.

### Summary

All acceptance criteria are satisfied by passing tests or by documented MANUAL-QA steps in the plan. No criterion is UNCOVERED. All scripts pass with exit code 0.
