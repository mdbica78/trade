# Verification verdicts

One file per story per reviewer, written by the reviewing chat (or by the user, relaying it) so the verdict survives independently of that chat's own memory:

- `US-XXX-review.md` — Technical Lead's code-review verdict (format in `roles/technical-lead.md`).
- `US-XXX-tests.md` — Troubleshoot's test-run verdict (format in `roles/troubleshoot.md`).

The PO reads both before deciding whether a story is Done or needs a fix ticket, and records the outcome in `status.md`. These files are history once a story is Done — they are not overwritten by later stories.
