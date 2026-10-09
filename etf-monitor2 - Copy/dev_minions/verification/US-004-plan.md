# US-004 plan: Bilingual (RO/EN) infrastructure and language switcher

Planned by story-planner (opus), 2026-09-23. No decisions needed. Implement directly.

Sources read: story US-004, requirements FR8.1 and section 5, ADR-001 (next-intl), DEC-002, DEC-007
(number display, out of scope here), DEC-008 (`--webpack`), `architecture/data-model.md`
(`settings.default_locale`), US-006 (downstream consumer of the health strings and of `/health`),
`package.json`, `next.config.ts`, `vitest.config.ts`, `tsconfig.json`, `eslint.config.mjs`,
`pnpm-workspace.yaml`, `app/layout.tsx`, `app/page.tsx`, `README.md`, and the US-003 plan (format).

Environment facts:
- Run commands in WSL1 "Ubuntu" (node 20, pnpm 12.5.1). Export
  `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt` in every non-interactive shell (DEC-002, DEC-008).
- `dev`/`build` already use `--webpack` (DEC-008). Keep them that way.
- pnpm 12's minimum-release-age policy may resolve a slightly older `next-intl`. That is fine. Only if
  install fails, add a `minimumReleaseAgeExclude` entry for the exact version, the same way as the `next@16.3.6` entries.
- No `@/` imports exist yet and `vitest.config.ts` has no alias. See risk 3.

---

## Key design choice (settled by the story, not a decision)

Use next-intl's **"without i18n routing"** setup. URLs have no locale prefix (no `/ro/...`, `/en/...`),
there is no middleware/proxy, and the locale comes from a cookie that is read server-side in
`i18n/request.ts`. The story fixes this choice. Task 3 says the locale persists in a cookie
readable server-side, and US-006 expects the page at `/health`, not `/ro/health`. AC1 says Romanian
by default, so the `Accept-Language` header is **not** consulted. No cookie means `ro`.
`settings.default_locale` (data-model) is **not** read in this story. No FR asks for a
runtime-configurable default, and reading the DB here would make every page (and the build and
the tests) depend on Neon. The constant `defaultLocale = "ro"` is the source for now.

---

## 1. Acceptance criteria and the test that proves each

| AC | Criterion (restated) | Proof |
|---|---|---|
| AC1 | With no locale cookie, the app renders in Romanian. | (a) `i18n/request.test.ts`: `vi.mock("next-intl/server", () => ({ getRequestConfig: (fn) => fn }))` plus `vi.mock("next/headers")` with a cookie store that returns `undefined`. The default export, when awaited, gives `{ locale: "ro", messages }`, where `messages` deep-equals `messages/ro.json`. Further cases: cookie `NEXT_LOCALE=en` gives `en`, and the cookie values `"fr"`, `""` and `"EN"` all give `ro` (anything not in the list falls back to the default, and matching is exact). (b) `i18n/locale.test.ts`: `resolveLocale(undefined) === "ro"`, `resolveLocale("en") === "en"`, `resolveLocale("de") === "ro"`. `defaultLocale === "ro"`. `locales` deep-equals `["ro","en"]`. (c) Optional server-render check for the tester (not required, since it starts a local server). After `pnpm build`, run `pnpm start -p 3100 &` and then `curl -s localhost:3100/`. The HTML contains `<html lang="ro"` and the `App.name` value from ro.json. |
| AC2 | The switcher changes all visible labels between RO and EN. | (a) `components/AppHeader.test.tsx` and `app/page.test.tsx` (or one `components/i18n-render.test.tsx`) render `<NextIntlClientProvider locale={l} messages={m}>` around `AppHeader` and the home-page body, using `react-dom/server`'s `renderToStaticMarkup`, once with ro and once with en. For each locale, every visible text node equals the value of the catalogue key it comes from. Assert against the imported JSON, not hard-coded literals. For each key whose ro and en values differ, the ro render does not contain the en value and the en render does not contain the ro value. (b) `components/LanguageSwitcher.test.tsx` renders the switcher in both locales. Mock `@/i18n/actions`, so no `next/headers` is loaded. Assert a `<form>` exists with two `<button type="submit" name="locale">`, with values `ro` and `en`, whose texts are `LanguageSwitcher.ro` and `LanguageSwitcher.en` from the active catalogue. The button for the current locale has `aria-current="true"` and `disabled`, and the other has neither. The form has `aria-label` = `LanguageSwitcher.label`. (c) `i18n/actions.test.ts` mocks `next/headers` `cookies()`. `setLocale(formData{locale:"en"})` calls `cookies().set("NEXT_LOCALE", "en", { path: "/", maxAge: 31536000, sameSite: "lax" })`. Given `"fr"`, a missing field or a non-string value, it does **not** set a cookie. The call must not throw either, because a bad form post must not produce a 500. (d) Browser click-through is a QA checklist step (local `pnpm dev`, not a live resource). |
| AC3 | The chosen locale survives a full page reload. | Covered by the combination of AC2(c) (the cookie is set with path `/` and a one-year `maxAge`, not a session cookie) and AC1(a) (the request config reads that cookie on every request). Optional tester check: `curl -s -H "Cookie: NEXT_LOCALE=en" localhost:3100/` returns `<html lang="en"` and the en `App.name`. Browser reload check goes in the QA checklist. |
| AC4 | `messages/ro.json` and `messages/en.json` have identical key structures. | `i18n/messages.test.ts` › "catalogues have identical keys". `collectKeyPaths(obj)` returns the sorted dotted leaf paths, recursively. `expect(collectKeyPaths(ro)).toEqual(collectKeyPaths(en))`, so on failure the diff shows the offending key. Also assert that every leaf in both files is a non-empty string (no arrays, numbers or `null`), because a key that is present but empty would pass the parity test yet render blank. |
| AC5 | A unit test fails if a key exists in only one catalogue. | `i18n/messages.test.ts` › "drift is detected". Deep-clone the real `ro.json`, add `__drift_probe__: "x"` (top level) and `Nav.__drift_probe__` (nested), and assert that `findKeyMismatches(roClone, en)` returns `{ onlyInA: ["Nav.__drift_probe__","__drift_probe__"], onlyInB: [] }`. Do the reverse for en. Also assert `assertSameKeys(roClone, en)` **throws**, with a message naming the probe key. `assertSameKeys` is the function the parity test in AC4 uses, so this proves the real test would go red. This is the story's "temporarily add a key" check, done in memory, and the catalogue files are never edited. The literal on-disk version is also a QA checklist step for the user. The tester does not edit files. |
| AC6 | No hard-coded user-facing string remains in any component added or modified by this story. | (a) Lint guard. In `eslint.config.mjs`, add a config block for `app/**/*.tsx` and `components/**/*.tsx` that ignores `**/*.test.tsx`, with `"react/jsx-no-literals": ["error", { noStrings: false, ignoreProps: true, allowedStrings: [] }]`. `pnpm lint` then fails on any JSX text literal. (b) Typed keys. `global.d.ts` augments next-intl's `AppConfig` with `Messages: typeof ro` and `Locale`, so `pnpm typecheck` fails on an unknown key. (c) Reviewer check for what lint cannot see: string props that users can see (`title`, `aria-label`, `alt`, `placeholder`) and `metadata`. The tab title comes from `generateMetadata` via `getTranslations`. The scaffold's "Create Next App" metadata and the template `app/page.tsx` content are removed. |
| AC7 | `pnpm test`, `pnpm lint` and `pnpm build` pass. | The tester runs `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `env -u DATABASE_URL pnpm test` and `env -u DATABASE_URL pnpm build`. Build output: routes that use the locale cookie render as dynamic (`ƒ`). That is expected, not a failure. |
| Task 5 | The README documents the "no hard-coded strings" convention. | Reviewer check. The root `README.md` has an "Internationalisation" section covering: every user-facing string goes through a next-intl key; add each key to **both** `messages/ro.json` and `messages/en.json` (the parity test enforces this); the lint rule and typed keys; server components use `getTranslations`/`useTranslations`, client components use `useTranslations`; DB-sourced labels use `label_ro`/`label_en` (out of scope here); number display follows DEC-007 in a later story. |

---

## 2. Files and boundaries

| File | New/changed | Responsibility, and what it must NOT do |
|---|---|---|
| `package.json`, `pnpm-lock.yaml` | changed | `pnpm add next-intl` (ADR-001; a 4.x release whose peer range includes Next 16). **No** other new dependencies. Specifically, no jsdom or @testing-library, because render tests use `react-dom/server`, which is already installed. |
| `i18n/locale.ts` | new | Pure module with no Next or next-intl imports: `export const locales = ["ro","en"] as const; export type Locale = typeof locales[number]; export const defaultLocale: Locale = "ro"; export const LOCALE_COOKIE = "NEXT_LOCALE"; export function isLocale(v: unknown): v is Locale; export function resolveLocale(v: string \| undefined): Locale`. It is the single source of the locale list. |
| `i18n/request.ts` | new | `export default getRequestConfig(async () => { const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value); return { locale, messages: (await import(\`../messages/${locale}.json\`)).default }; })`. No DB access and no Accept-Language. |
| `i18n/actions.ts` | new | `"use server"`. `export async function setLocale(formData: FormData): Promise<void>` reads `formData.get("locale")`. If `isLocale`, it sets the cookie (name, path `/`, `maxAge` 31536000, `sameSite: "lax"`). Otherwise it does nothing. Setting a cookie in a Server Action makes Next re-render the current route, so no `redirect`/`revalidatePath` is needed. If manual QA shows the labels do not refresh, add `revalidatePath("/", "layout")`. |
| `i18n/keys.ts` | new | Pure helpers used by the tests: `collectKeyPaths`, `findKeyMismatches`, `assertSameKeys`. It lives outside the test file so AC5 can exercise the same function AC4 uses. |
| `messages/ro.json`, `messages/en.json` | new | Same structure, UTF-8, Romanian with correct diacritics (ș, ț with comma below). Seed set (below). |
| `messages/.gitkeep` | delete | The folder is no longer empty. |
| `global.d.ts` | new | `import type ro from "./messages/ro.json"; import type { Locale } from "./i18n/locale"; declare module "next-intl" { interface AppConfig { Locale: Locale; Messages: typeof ro } }`. |
| `next.config.ts` | changed | Wrap with `createNextIntlPlugin("./i18n/request.ts")`. No other config changes. |
| `app/layout.tsx` | changed | `async`. `const locale = await getLocale(); const messages = await getMessages();`, `<html lang={locale}>`, wrap the body in `<NextIntlClientProvider locale={locale} messages={messages}>` (so future client components work), then `<AppHeader />` and `{children}`. Replace the static `metadata` with `generateMetadata()` using `getTranslations("Metadata")`. Keep the fonts and classes. |
| `app/page.tsx` | changed | Replace the create-next-app template with a minimal translated home placeholder: an `App.name` heading and a `Home.intro` paragraph. Non-async, uses `useTranslations`, and has no images or external links. |
| `components/AppHeader.tsx` | new | Server-compatible component (no `"use client"`, non-async, `useTranslations`). App name, a nav with **only** the `Nav.home` link to `/` (no links to routes that do not exist yet; US-006 adds `/health`), and `<LanguageSwitcher />`. Tailwind only. |
| `components/LanguageSwitcher.tsx` | new | Server-compatible, **no client JS**. `<form action={setLocale} aria-label={t("label")}>` with one `<button type="submit" name="locale" value={l}>` per entry in `locales`. The label comes from `t(l)`. The current locale (`useLocale()`) gets `aria-current="true"` and `disabled`. It works without JavaScript (progressive enhancement), and the click-to-action wiring is native form semantics, so there is no handler to unit-test. It imports the list from `i18n/locale.ts` and never hard-codes `"ro"`/`"en"`. |
| `i18n/locale.test.ts`, `i18n/request.test.ts`, `i18n/actions.test.ts`, `i18n/messages.test.ts` | new | AC1, AC3, AC4, AC5. |
| `components/LanguageSwitcher.test.tsx`, `components/AppHeader.test.tsx` (the home-page render may go in the same file) | new | AC2. |
| `vitest.config.ts` | changed (only if needed) | Add `resolve.alias` `{ "@": <repo root> }` if tests import `@/…` modules, and `test.server.deps.inline: ["next-intl"]` if Vitest cannot resolve next-intl's ESM `next/*` imports (risk 2). `include`/`exclude` stay as they are. |
| `eslint.config.mjs` | changed | Add the `react/jsx-no-literals` block from AC6. The `react` plugin is already registered by `eslint-config-next`, so no new dependency is needed. |
| `README.md` | changed | Add the "Internationalisation" section (task 5). Do not add the env/deploy docs, which belong to US-006. |

Untouched: `lib/format.ts` (DEC-007 display belongs to a later story), `lib/db/**`, `drizzle/**`, `.env.example`.

Boundary: later UI stories import `locales`/`Locale` from `@/i18n/locale`, translate with
`useTranslations`/`getTranslations`, and add keys to both catalogues. Only `i18n/request.ts` knows
where the locale comes from, so if a runtime default is ever needed (for example `settings.default_locale`), that is a one-file change.

### Seed catalogue (key structure; the en values are shown, the ro values are in brackets)
- `Metadata.title` "BVB ETF Monitoring" [Monitorizare ETF BVB] and `Metadata.description` "Daily monitoring of BVB-listed ETFs" [Monitorizarea zilnică a ETF-urilor listate la BVB]. The name comes from the requirements document title.
- `App.name`: the same value as `Metadata.title`.
- `Home.intro` "The table of monitored ETFs will appear here." [Tabelul ETF-urilor monitorizate va apărea aici.] (FR7 placeholder)
- `Nav.home` "Home" [Acasă], `Nav.admin` "Administration" [Administrare], `Nav.health` "System status" [Starea sistemului]. Only `home` is rendered now; the others are for section 5 and US-006.
- `LanguageSwitcher.label` "Language" [Limbă], `LanguageSwitcher.ro` "RO", `LanguageSwitcher.en` "EN" (identical in both catalogues). These are keys, not literals, so AC6 holds.
- `Health.title` "System status" [Starea sistemului], `Health.database` "Database" [Bază de date], `Health.dbConnected` "Connected" [Conectată], `Health.dbUnreachable` "Database unreachable" [Baza de date nu poate fi accesată], `Health.dbError` "Error: {message}" [Eroare: {message}], `Health.etfCount` "ETFs in registry" [ETF-uri în registru], `Health.fieldCatalogCount` "Fields in catalogue" [Câmpuri în catalog], `Health.locale` "Current language" [Limba curentă], `Health.localeName.ro` "Română", `Health.localeName.en` "English" (the same in both catalogues). This set follows the four items in US-006's task 1 and the failure state in its task 2. US-006 may add keys but should not need to rename these.

The Romanian copy is agent-written. The PO reviews it at the demo, and changing it only means editing JSON.

---

## 3. Data model changes

None. No migration. `settings.default_locale` stays unused (see Key design choice).

---

## 4. Risks and the smallest design

1. **Every route becomes dynamic.** Reading `cookies()` in the request config opts pages out of static rendering. That is accepted: the app is data-driven per request anyway, and US-006's `/health` is dynamic by nature. Do not add `setRequestLocale` or `generateStaticParams`. Those belong to prefix routing.
2. **next-intl under Vitest.** next-intl's ESM build may import `next/navigation` without a file extension, and Vitest in node can fail with "Cannot find module …/next/navigation". Fix: `test.server.deps.inline: ["next-intl"]`. Importing `next-intl/server` outside the `react-server` condition gives stubs that throw. Tests therefore never import it for real. `request.test.ts` mocks it (`getRequestConfig: fn => fn`), and components use `useTranslations`/`useLocale` from `next-intl` (which work under `NextIntlClientProvider` in tests and in React Server Components in Next), never `getTranslations`. `getTranslations`/`getLocale`/`getMessages` are used only in `app/layout.tsx`, which has no unit test. The build and the optional curl check cover it.
3. **Path alias in tests.** Vitest does not read tsconfig `paths`. Either use relative imports in the modules under test, or add `resolve.alias` in `vitest.config.ts`. Do **not** add `vite-tsconfig-paths`.
4. **A function `action` prop in `renderToStaticMarkup`.** React 19 serialises a function form action to a placeholder `action` attribute and does not throw. If the installed version throws, render the switcher test with the action mocked as a plain function and assert on the buttons. Do not add jsdom for this.
5. **JSX in `.test.tsx`.** Vite's esbuild follows tsconfig `"jsx": "react-jsx"`. If it does not, set `esbuild: { jsx: "automatic" }` in `vitest.config.ts`.
6. **`react/jsx-no-literals` noise.** Whitespace-only JSX text is ignored by the rule. If a pure punctuation separator is ever needed, put it in a message key rather than widening `allowedStrings`. If the rule cannot be enabled cleanly under the flat config, keep the typed keys and the reviewer check, and record the reason in HANDOVER. Do not silently drop it.
7. **Next 16 + webpack + the next-intl plugin.** `createNextIntlPlugin` supports both bundlers. If `pnpm build --webpack` fails on it, that is a real defect to fix, not a reason to drop the plugin.
8. **Fonts.** `next/font/google` in the layout already fetches during build (US-002 passes). Do not touch it.

Extensibility is kept exactly where the requirements need it. Adding a third locale is a matter of appending it to `locales` and adding a catalogue, which the parity test would then need to cover (no FR asks for this; out of scope). Nothing else is built: no locale-prefixed routing, no DB-driven default, no number formatting (DEC-007 later).

---

## 5. Decisions needed

None.

Choices made in this plan, which the reviewer should treat as intentional rather than as gaps:
- routing without a locale prefix, cookie-only, where no cookie means `ro` and `Accept-Language` is ignored (AC1, task 3, US-006's `/health` path);
- cookie name `NEXT_LOCALE`, one-year `maxAge`, `sameSite: "lax"`;
- the switcher is a server-rendered `<form>` with two submit buttons (no client JS), and the current locale is disabled and marked `aria-current`;
- only the Home nav link is rendered;
- the `Nav.admin`/`Nav.health`/`Health.*` keys are seeded but unused;
- `react/jsx-no-literals` and typed `AppConfig` keys are the guards for AC6;
- `settings.default_locale` is not read.
