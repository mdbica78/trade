# US-004 QA checklist — Bilingual (RO/EN) infrastructure and language switcher

Round 1: story-reviewer PASS (`US-004-review.md`), story-tester PASS (`US-004-tests.md`, 45/45 tests, typecheck/lint/build all green). No fix loop needed.

## Manual checks for the user

1. **Browser click-through (local dev).**
   `cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt && pnpm dev`, open `http://localhost:3000`.
   Expected: page renders in Romanian by default (no cookie set yet). Click the "EN" button in the language switcher — all visible text (heading, intro, nav, switcher labels) switches to English immediately, and the "EN" button becomes disabled/current. Reload the page — it stays in English (cookie persisted). Click "RO" to switch back.

2. **PO to confirm the Romanian copy.** The seed catalogue's Romanian strings (`messages/ro.json`) were agent-written (story-planner). Read through `App.name`, `Home.intro`, `Nav.home`, `LanguageSwitcher.*`, and the `Health.*` set (used later by US-006) for correctness and tone.

3. **On-disk key-drift sanity check (optional, the unit test already proves this logic).**
   Temporarily add a throwaway key to `messages/ro.json` only, run `pnpm test`, confirm `i18n/messages.test.ts` fails, then revert the edit (do not commit it).

## Notes carried from review (non-blocking)

- Warning: `i18n/request.ts` has no `timeZone` configured, so next-intl logs an `ENVIRONMENT_FALLBACK` warning to stderr during tests (tests still pass, no dates are formatted yet). Should be set before any story that formats dates/times (e.g. the history/detail pages).
- A test-only bug was fixed during implementation: `components/LanguageSwitcher.test.tsx`'s disabled/aria-current assertion used a fixed-width string slice around the button's index; for the first (RO) button this produced a negative slice start that silently collapsed to an empty string, and the fix (isolating each `<button>` tag with a regex match) is a self-contained test correctness fix, not a scope or criteria change.

## Files changed

- package.json, pnpm-lock.yaml (`pnpm add next-intl`)
- pnpm-workspace.yaml (edited)
- messages/ro.json, messages/en.json (new); messages/.gitkeep (deleted)
- i18n/locale.ts, i18n/keys.ts, i18n/request.ts, i18n/actions.ts (new)
- global.d.ts (new)
- next.config.ts (edited)
- components/LanguageSwitcher.tsx, components/AppHeader.tsx (new)
- app/layout.tsx, app/page.tsx (rewritten)
- eslint.config.mjs, vitest.config.ts (edited)
- i18n/locale.test.ts, i18n/messages.test.ts, i18n/actions.test.ts, i18n/request.test.ts (new)
- components/LanguageSwitcher.test.tsx, components/AppHeader.test.tsx, app/page.test.tsx (new)
- README.md (edited — Internationalisation section)
- dev_minions/verification/US-004-plan.md, US-004-review.md, US-004-tests.md, US-004-qa.md (new)
