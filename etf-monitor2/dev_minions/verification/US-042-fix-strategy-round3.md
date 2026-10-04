# US-042 — round 3 fix strategy

The round-2 review found that Romanian vendor-specific requests such as
`setează cheia Gemini` bypass the pre-provider refusal. The planner agent could
not launch in this environment (its configured model is unavailable), so this
is the Copilot fallback strategy; the review finding remains binding.

1. Extend the existing deterministic detector to recognize `cheia Gemini` and
   `cheia Groq` as well as `cheia de la ...`, and action-plus-generic-key requests
   in both languages. Keep it before dependency creation; never inspect or echo
   the submitted key value.
2. Add table-driven refusal tests for these variants and benign field-tracking
   requests. Assert that no dependency, provider, context or execution path is
   called, the outcome is the closed `key_request`, and the transcript contains
   only the localized hidden-request label and fixed admin reply.
3. Re-run focused and local project gates, then obtain an independent review of
   AC3 only in round 3; preserve the existing independent tester PASS.
