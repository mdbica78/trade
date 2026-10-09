# US-006 review — Deploy to Vercel with a health-check page

## Round 1 — 2026-09-23

Verdict: PASS

Reviewer: story-reviewer subagent (independent context, did not write this code). No git commands were run; findings are based on reading the files listed under "Files changed" in HANDOVER.md plus a grep for stray usages of the story's new symbols (`getHealthStatus`, `HealthStatus`), and running `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` locally.

### Acceptance criteria

- **AC1** — `/health` renders locally and shows correct counts against a seeded database.
  MET (manual QA). The plan (`dev_minions/verification/US-006-plan.md`) correctly marks this MANUAL-QA — it needs a live/seeded database, which tests must not touch (AGENTS.md: "Tests never call live Neon... mock them"). `app/health/page.tsx:14-56` renders `status.etfCount`/`status.fieldCatalogCount` from `getHealthStatus(getDb())`, and `app/health/page.test.tsx:44-58` proves the rendering logic against a mocked status object (`{dbConnected:true, etfCount:3, fieldCatalogCount:8}` → HTML contains `>3<`, `>8<`). The remaining live check (real counts against the real seed) is correctly deferred to the QA checklist per the story's own "Manual steps" section.

- **AC2** — When the database is unreachable, `/health` renders a clear error state and returns HTTP 200 (not a 500, not a blank page).
  MET. `lib/health.ts:9-19` — `getHealthStatus` wraps both queries in `try/catch` and always returns a discriminated-union value, never rethrows. `app/health/page.tsx:6-12` (`loadHealthStatus`) adds a second layer of defense: it also wraps the call to `getHealthStatus(getDb())` in `try/catch`, because `getDb()` itself can throw `MissingDatabaseUrlError` synchronously before `getHealthStatus` ever runs (`lib/db/index.ts:17-22`). Because `HealthPage` never throws, calls `notFound()`, or calls `redirect()`, Next.js renders it as a normal 200 response. `lib/health.test.ts:22-46` proves the "never throws" contract for both `Error` and non-`Error` rejections. `app/health/page.test.tsx:60-67` proves the failure branch renders `Health.dbUnreachable` and the error text, and does not render the connected-state copy. Verified `pnpm build` succeeds and `/health` is listed as a dynamic route — no static generation would mask a runtime-only failure.

- **AC3** — Labels on `/health` switch between Romanian and English with the language switcher.
  MET. `messages/ro.json`/`messages/en.json` both define a matching `Health` namespace (title, database, dbConnected, dbUnreachable, dbError, etfCount, fieldCatalogCount, locale, localeName.ro/en) and `Nav.health`; `i18n/messages.test.ts` (pre-existing, reused) fails the build if the two catalogues drift. `app/health/page.tsx` sources every visible label through `t(...)` — no hard-coded JSX text (confirmed lint's `react/jsx-no-literals` rule passes). `app/health/page.test.tsx:44-58` renders the page for both locales (`it.each(["ro","en"])`) and asserts the RO/EN label text differs and matches the catalogue. `components/AppHeader.tsx:13` adds the `Nav.health` link so the page is reachable from the header that carries the language switcher, consistent with the US-004 mechanism (cookie-based locale, `LanguageSwitcher` server action).

- **AC4** — Unit tests cover both the success and failure paths; `pnpm test` passes with no database available.
  MET. `lib/health.test.ts` has three tests: success path (`fakeDb` resolving counts), failure path with an `Error` rejection, and failure path with a non-`Error` throw (defends against leaking the raw query builder / verifies message extraction). All use an in-memory mock shaped like `Db` — no real `neon()`/`drizzle()` client. Ran `pnpm test` with no `DATABASE_URL` set beyond what's in the environment already (no live DB reachable from this sandbox regardless): 56/56 tests pass, including all `lib/health.test.ts` and `app/health/page.test.tsx` tests.

- **AC5** — The root `README.md` documents the required environment variables, the migration command, and the deployment steps.
  MET. `README.md`'s "Environment variables" section documents `DATABASE_URL` and `CRON_SECRET` (reserved, Sprint 3). The new "Deployment" section (`README.md:73-83`) is a 7-step list: create Neon DB, create Vercel project, set env vars, `pnpm db:migrate` against Neon, `pnpm db:seed`, deploy, verify `/health`. A "Health check" section (`README.md:85-90`) documents what `/health` reports and its always-200 contract. Matches the story's three required topics (env vars, migration command, deployment steps) plus more context than the minimum.

- **AC6** — `pnpm build` succeeds.
  MET. Ran `pnpm build` locally (after a stale concurrent build process from the live autopilot session cleared): "Compiled successfully", TypeScript pass, all pages generated, `/health` listed as a dynamic (server-rendered on demand) route alongside `/` and `/_not-found`.

### Findings (ordered by severity)

No Critical findings.

1. **Warning** — `app/health/page.tsx:1` imports `getTranslations`/`getLocale` from `next-intl/server` (the async variant). `README.md`'s Internationalisation section, written for US-004 and followed consistently since (`app/page.tsx` and `components/AppHeader.tsx` both use the synchronous `useTranslations()` from `"next-intl"`), states the async `next-intl/server` API is reserved for `app/layout.tsx` only: "Server components call `useTranslations()`/`useLocale()` from `next-intl` (or, in `app/layout.tsx` only, `getTranslations()`/`getLocale()`/`getMessages()` from `next-intl/server`)." `HealthPage` is already an `async function` (it awaits `getHealthStatus`), and next-intl's `useTranslations`/`useLocale` are documented to work inside Server Components without needing to be async, so there was no technical need to deviate. Functionally harmless (tests pass, translations resolve correctly, verified by `app/health/page.test.tsx`), but it breaks the project's own stated convention and, left unaddressed, invites the next server page to copy the exception rather than the rule. Recommend fixing before or shortly after merge — not a blocker for this story's ACs since the README rule is a self-imposed codebase convention, not one of AGENTS.md's non-negotiable architecture rules.

2. **Note** — `app/health/page.tsx` renders the raw underlying error message (`status.error`, ultimately `error.message` from the Neon/postgres driver) in the UI, and the page is intentionally unauthenticated (explicitly out of scope per the story: "Do not add authentication"). This is very likely fine — Neon/postgres connection errors typically don't embed credentials — but it does mean infrastructure detail (hostnames, driver error text) is visible to any anonymous visitor once deployed. Not a secrets leak under AGENTS.md's rule (no secret is in code or committed), just worth a second look before the story is demoed publicly. No action required to pass this story.

3. **Note** — `components/AppHeader.test.tsx` was not updated to assert the new `Nav.health` link renders (it still only asserts `Nav.home`/`App.name`). Not required by any AC — AC3 is about `/health`'s own labels, which `app/health/page.test.tsx` covers — but a quick addition would close a small coverage gap on the header itself.

### Scope deviations

- None. `vercel.json` was correctly omitted per the plan ("only added if a concrete setting is needed" — Sprint 1 has no cron yet); confirmed no `vercel.json` was added and `pnpm build` did not surface a need for one.
- Grepped for `getHealthStatus`/`HealthStatus` repo-wide: only appears in `lib/health.ts`, `lib/health.test.ts`, `app/health/page.tsx`, `app/health/page.test.tsx` — matches the "Files changed" list in HANDOVER.md exactly, plus the expected `components/AppHeader.tsx` (nav link) and `README.md` (docs) edits. No unrequested refactors or extra dependencies. `package.json`/`pnpm-lock.yaml` changes visible in the working tree belong to the already-in-flight US-005 (`db:seed` script), not this story.

### Process check

No git commands were run during this review (per AGENTS.md/role brief). Verified via `Read`/`Grep`/`Bash` (non-git) only, plus `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
