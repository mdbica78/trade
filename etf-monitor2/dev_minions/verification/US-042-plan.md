# US-042 plan — bilingual chat instructions

Draft criteria AC1–AC4 in `../backlog/stories/US-042.md` cite FR17; PO to confirm.
- Add a static instruction section to `components/chat/ChatView.tsx` in every
  availability state, using only `useTranslations("Chat")` strings in both
  `messages/en.json` and `messages/ro.json`. No provider or key material.
- List exactly the existing `CONFIGURATION_ACTIONS`: add/remove an ETF and
  track/untrack a field. Link key setup to `/admin/ai`; explicitly tell users
  not to paste keys into chat. Do not advertise widgets, raw-field extraction,
  or multi-action requests before Sprint 11.
- Test the rendered section in `components/chat/ChatView.test.tsx` for both
  locales and every availability state; pin its four categories against the
  exported `CONFIGURATION_ACTIONS` in a focused scope-guard test. In
  `app/chat/page.test.tsx`, prove page wiring with no provider/network call.
  Preserve existing key-request refusal tests and translation parity.
- Run the focused UI/page tests, typecheck, lint, full offline tests and build
  without database or provider access. No migration, dependency or live step.
