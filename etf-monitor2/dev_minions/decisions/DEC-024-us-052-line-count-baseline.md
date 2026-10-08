# DEC-024 — US-052 source line-count baseline unavailable

Status: **DECIDED — accepted by the user** (2026-10-05)

## Context
US-052 AC6 requires HANDOVER to record `wc -l` before and after for touched
source files. The implementation phase did not record the pre-edit counts.
The independent review and test verdicts for round 1 both fail AC6 for this
reason; all other criteria and executable gates pass. No independent baseline
copy has been found. Reconstructing the original files from version history
would require a prohibited git operation.

## Decision needed
May US-052 close its development gates with the documented post-edit counts
and explicit disclosure that baseline counts are unavailable, or must it
remain blocked until the PO supplies another permissible baseline source?

## User decision
**Accepted option 1.** The user accepted the missing pre-edit baseline as an
explicit AC6 evidence limitation and authorized US-052 to proceed to QA. The
post-edit counts remain documented, but no before/after reduction is claimed.
The original Round 1 review and test verdicts remain unchanged and continue to
record AC6 as NOT MET; this decision is a PO-approved exception, not a
retroactive change to those verdicts or evidence.

## Options
1. **Accept the evidence limitation (recommended):** keep the post-edit counts
   and document the missing baseline; allow the story to proceed to QA. No code
   behavior or tests change.
2. **Keep AC6 strict:** leave US-052 blocked until the PO supplies original
   line counts from an independent source. Do not infer or fabricate counts.

## Trade-offs
Option 1 allows the simplified implementation to proceed, but the total line
reduction cannot be quantified. Option 2 preserves the original measurable
criterion but needs historical data that is not present in the workspace.
