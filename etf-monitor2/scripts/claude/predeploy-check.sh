#!/usr/bin/env bash
# Pre-deploy gate (DEC-019 §4). Run it before you commit and push: it does what Vercel's build
# does (typecheck, then next build) plus lint and the tests, offline, in that order.
#   bash scripts/claude/predeploy-check.sh
# The four variables below are unset for every step so nothing can reach Neon or an AI provider.
# It runs no git, makes no network call of its own and prints no variable value.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
export NODE_EXTRA_CA_CERTS="${NODE_EXTRA_CA_CERTS:-/etc/ssl/certs/ca-certificates.crt}"

for step in "pnpm typecheck" "pnpm lint" "pnpm build" "pnpm test"; do
  echo "=== $step"
  # shellcheck disable=SC2086
  if ! env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY -u CRON_SECRET $step; then
    echo
    echo "PREDEPLOY: FAIL at '$step' — do not push."
    exit 1
  fi
done

echo
echo "PREDEPLOY: PASS — typecheck, lint, build and tests are green. Safe to commit and push."
