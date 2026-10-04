# US-039 QA run — 2026-10-02

**Verdict: BLOCKED.** The prescribed QA server could not build because `tsx` was unavailable, and the required offline contrast test could not resolve `@vitest/utils`. No 80-route browser captures or live route checks are claimed.

## Automated checks

| # | Check | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Install the locked dependencies | AUTO | PASS | `bash -lc 'set -e; pnpm install --frozen-lockfile; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY pnpm exec vitest run app/globals.contrast.test.ts'` → install portion **0** → lockfile up to date; 525 packages added. |
| 2 | Typecheck | AUTO | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY bash scripts/claude/predeploy-check.sh'` → overall **1**; its `pnpm typecheck` phase ran `tsc --noEmit` and the script proceeded to lint, establishing typecheck exit 0. |
| 3 | Lint | AUTO | FAIL (shared in-progress work) | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY pnpm lint'` → **1** → `ProviderKeySaveForm.tsx:33` `react-hooks/refs`; `✖ 10 problems (1 error, 9 warnings)`. The file is part of the active US-040 implementation, not US-039's documentation-only changes. |
| 4 | Full test suite | AUTO | BLOCKED | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY pnpm test'` → **1** → Vitest reports `lib/ai/capabilities/boundaries.test.ts` CB-3 failing because `lib/ai/key-store.ts contains sql`; it then exits with `ERR_MODULE_NOT_FOUND` for `@vitest/utils`. These current US-040/tool-install issues prevent a trustworthy full-suite result for US-039. |
| 5 | Required offline contrast test | AUTO | BLOCKED | `bash -lc 'set -e; pnpm install --frozen-lockfile; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY pnpm exec vitest run app/globals.contrast.test.ts'` → **1** → Vitest worker reports `ENOENT` for `node_modules/.pnpm/@vitest+utils@3.2.7/node_modules/@vitest/utils/dist/index.js`. |
| 6 | Production build, generating styles and route types | AUTO | BLOCKED | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY pnpm build'` → **127** → `$ tsx scripts/migrate-on-deploy.ts && next build --webpack`; `tsx: not found`. |
| 7 | Start no-database app only through `qa-serve.sh` | AUTO | BLOCKED | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY bash scripts/claude/qa-serve.sh start'` → **3** → `BUILD FAILED`; final lines are `tsx ...` / `tsx: not found`. |
| 8 | Required server cleanup | AUTO | PASS | `bash scripts/claude/qa-serve.sh stop` → **0** → `QA server stopped.` |
| 9 | App route checks in both locales and contrast results on each capture | AUTO-PARTIAL | NOT RUN | No app server started, so `qa-serve.sh get` was not run for any route and no per-screen contrast result is claimed. |

The attached browser page displayed the existing static fixture `.qa-render/home/home-en-dark.html`, not the running application. I resized its preview to 1200×560 and inspected it alongside `mockup-home-dark.png`; it does not include the live header/card required by D2, and the browser screenshot was not saved to an external capture path. This is not a D2 MATCH or a completed screenshot capture.

## Capture matrix (AC1–AC3)

No screenshots were saved. Contrast is unmeasured for every capture; each row is `AUTO-PARTIAL — not captured; app server unavailable`.

| ID | Route | Locale | Width | Theme | Screenshot | Contrast |
|---:|---|---|---:|---|---|---|
| 01 | `/` | ro | 375 | light | unavailable | not run |
| 02 | `/` | ro | 375 | dark | unavailable | not run |
| 03 | `/` | ro | 1280 | light | unavailable | not run |
| 04 | `/` | ro | 1280 | dark | unavailable | not run |
| 05 | `/` | en | 375 | light | unavailable | not run |
| 06 | `/` | en | 375 | dark | unavailable | not run |
| 07 | `/` | en | 1280 | light | unavailable | not run |
| 08 | `/` | en | 1280 | dark | unavailable | not run |
| 09 | `/etf/BTBETRETF` | ro | 375 | light | unavailable | not run |
| 10 | `/etf/BTBETRETF` | ro | 375 | dark | unavailable | not run |
| 11 | `/etf/BTBETRETF` | ro | 1280 | light | unavailable | not run |
| 12 | `/etf/BTBETRETF` | ro | 1280 | dark | unavailable | not run |
| 13 | `/etf/BTBETRETF` | en | 375 | light | unavailable | not run |
| 14 | `/etf/BTBETRETF` | en | 375 | dark | unavailable | not run |
| 15 | `/etf/BTBETRETF` | en | 1280 | light | unavailable | not run |
| 16 | `/etf/BTBETRETF` | en | 1280 | dark | unavailable | not run |
| 17 | `/admin` | ro | 375 | light | unavailable | not run |
| 18 | `/admin` | ro | 375 | dark | unavailable | not run |
| 19 | `/admin` | ro | 1280 | light | unavailable | not run |
| 20 | `/admin` | ro | 1280 | dark | unavailable | not run |
| 21 | `/admin` | en | 375 | light | unavailable | not run |
| 22 | `/admin` | en | 375 | dark | unavailable | not run |
| 23 | `/admin` | en | 1280 | light | unavailable | not run |
| 24 | `/admin` | en | 1280 | dark | unavailable | not run |
| 25 | `/admin/etfs` | ro | 375 | light | unavailable | not run |
| 26 | `/admin/etfs` | ro | 375 | dark | unavailable | not run |
| 27 | `/admin/etfs` | ro | 1280 | light | unavailable | not run |
| 28 | `/admin/etfs` | ro | 1280 | dark | unavailable | not run |
| 29 | `/admin/etfs` | en | 375 | light | unavailable | not run |
| 30 | `/admin/etfs` | en | 375 | dark | unavailable | not run |
| 31 | `/admin/etfs` | en | 1280 | light | unavailable | not run |
| 32 | `/admin/etfs` | en | 1280 | dark | unavailable | not run |
| 33 | `/admin/etfs/BTBETRETF/fields` | ro | 375 | light | unavailable | not run |
| 34 | `/admin/etfs/BTBETRETF/fields` | ro | 375 | dark | unavailable | not run |
| 35 | `/admin/etfs/BTBETRETF/fields` | ro | 1280 | light | unavailable | not run |
| 36 | `/admin/etfs/BTBETRETF/fields` | ro | 1280 | dark | unavailable | not run |
| 37 | `/admin/etfs/BTBETRETF/fields` | en | 375 | light | unavailable | not run |
| 38 | `/admin/etfs/BTBETRETF/fields` | en | 375 | dark | unavailable | not run |
| 39 | `/admin/etfs/BTBETRETF/fields` | en | 1280 | light | unavailable | not run |
| 40 | `/admin/etfs/BTBETRETF/fields` | en | 1280 | dark | unavailable | not run |
| 41 | `/admin/ai` | ro | 375 | light | unavailable | not run |
| 42 | `/admin/ai` | ro | 375 | dark | unavailable | not run |
| 43 | `/admin/ai` | ro | 1280 | light | unavailable | not run |
| 44 | `/admin/ai` | ro | 1280 | dark | unavailable | not run |
| 45 | `/admin/ai` | en | 375 | light | unavailable | not run |
| 46 | `/admin/ai` | en | 375 | dark | unavailable | not run |
| 47 | `/admin/ai` | en | 1280 | light | unavailable | not run |
| 48 | `/admin/ai` | en | 1280 | dark | unavailable | not run |
| 49 | `/admin/cron` | ro | 375 | light | unavailable | not run |
| 50 | `/admin/cron` | ro | 375 | dark | unavailable | not run |
| 51 | `/admin/cron` | ro | 1280 | light | unavailable | not run |
| 52 | `/admin/cron` | ro | 1280 | dark | unavailable | not run |
| 53 | `/admin/cron` | en | 375 | light | unavailable | not run |
| 54 | `/admin/cron` | en | 375 | dark | unavailable | not run |
| 55 | `/admin/cron` | en | 1280 | light | unavailable | not run |
| 56 | `/admin/cron` | en | 1280 | dark | unavailable | not run |
| 57 | `/admin/operations` | ro | 375 | light | unavailable | not run |
| 58 | `/admin/operations` | ro | 375 | dark | unavailable | not run |
| 59 | `/admin/operations` | ro | 1280 | light | unavailable | not run |
| 60 | `/admin/operations` | ro | 1280 | dark | unavailable | not run |
| 61 | `/admin/operations` | en | 375 | light | unavailable | not run |
| 62 | `/admin/operations` | en | 375 | dark | unavailable | not run |
| 63 | `/admin/operations` | en | 1280 | light | unavailable | not run |
| 64 | `/admin/operations` | en | 1280 | dark | unavailable | not run |
| 65 | `/chat` | ro | 375 | light | unavailable | not run |
| 66 | `/chat` | ro | 375 | dark | unavailable | not run |
| 67 | `/chat` | ro | 1280 | light | unavailable | not run |
| 68 | `/chat` | ro | 1280 | dark | unavailable | not run |
| 69 | `/chat` | en | 375 | light | unavailable | not run |
| 70 | `/chat` | en | 375 | dark | unavailable | not run |
| 71 | `/chat` | en | 1280 | light | unavailable | not run |
| 72 | `/chat` | en | 1280 | dark | unavailable | not run |
| 73 | `/health` | ro | 375 | light | unavailable | not run |
| 74 | `/health` | ro | 375 | dark | unavailable | not run |
| 75 | `/health` | ro | 1280 | light | unavailable | not run |
| 76 | `/health` | ro | 1280 | dark | unavailable | not run |
| 77 | `/health` | en | 375 | light | unavailable | not run |
| 78 | `/health` | en | 375 | dark | unavailable | not run |
| 79 | `/health` | en | 1280 | light | unavailable | not run |
| 80 | `/health` | en | 1280 | dark | unavailable | not run |

| Design ID | Reference | Result | Evidence |
|---|---|---|---|
| D1 | `mockup-home-light.png` | UNVERIFIED | No matching filled-table and live-header capture. |
| D2 | `mockup-home-dark.png` | UNVERIFIED | Reference opened; the attached static fixture preview lacks the required live header/card and no external screenshot was saved. |
| D3 | `mockup-home-dark-customize.png` | UNVERIFIED | No matching capture. |
| D4 | `mockup-home-phone.png` | UNVERIFIED | No matching capture. |

## For the user

- **AUTO-PARTIAL:** the 80-route matrix, browser theme/locale interaction, in-page contrast checks, and all four design comparisons remain unrun. The only available browser page was the static D2 filled-table fixture; no screenshots were saved to external paths. Retry after offline build and QA-server startup work.
- **JUDGMENT:** Does the app look right in both themes and on a phone, compared with `backlog/home-design/`? (screenshots: unavailable; only the unsaved static fixture preview was viewed)

No code, tests, project screenshots, dependency manifests, or lockfiles were edited. No real database, deployment, Vercel settings, git command, or secret was accessed. Denied or attempted commands: none.
