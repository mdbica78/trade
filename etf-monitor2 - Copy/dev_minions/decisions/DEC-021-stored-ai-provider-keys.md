# DEC-021 — AI provider keys stored in the app (FR16)

Status: **Decided** (Technical Lead chat, 2026-09-28) for everything technical. **Amended the same day after the user's rule "no pnpm or manual step, everything ships with git push"**: no live step is needed any more (master key derived by default, migration applied by the deploy, DEC-023). The accepted risk stays on record (below).
Overrides: Sprint 5 decision 9 (keys only in environment variables). Amends: DEC-017 §4 (key boundary), AGENTS.md "Secrets" (one exception).
Input: FR16 (requirements §8), user decisions of 2026-09-28: key entry from `/admin/ai`, write-only, never shown after saving. The app has no login and the user does not want one raised or asked about (2026-09-28); nothing in this project proposes or waits for a login.
Scope of change: Sprint 10 US-040 and US-041.

## Context
Today a provider key exists only as an environment variable (`key-status.ts` is the one `process.env` reader in `lib/ai`;
`provider-deps.ts` is the one wiring module). Setting or changing a key means editing Vercel and redeploying. The user wants to
do it from the browser, without a login. That means anyone who can reach `/admin/ai` can replace or
overwrite the key and can spend its quota through `/chat`. The user has accepted that; it is not revisited.

## Decision
1. **Where keys live.** New table `ai_provider_keys` (own migration, its own table, **not** a column on `settings`, so a missing
   migration cannot break queries that select `settings` or `etfs`): `provider_id text primary key`, `ciphertext text not null`
   (base64 of `iv ‖ tag ‖ ciphertext`), `key_source text not null` (`'master'` or `'cron_derived'`, see §2), `updated_at timestamptz not null`.
   No column ever holds plaintext, a prefix, a suffix or a length. Nothing "last 4 characters" is shown: after saving, the key is gone from every view.
2. **Encryption.** AES-256-GCM with Node's built-in `crypto` (no dependency, Node runtime only, never Edge). Fresh random 12-byte
   IV per write; the provider id is bound as additional authenticated data, so a ciphertext copied to another row fails to decrypt.
   **Where the encryption key comes from (no manual step).** Two sources, tried in this order:
   (a) `AI_KEY_MASTER_KEY`, if the user ever chooses to set it: 32 random bytes, base64; wrong length or not base64 counts as absent. Optional; nothing requires it.
   (b) **Default: derived from `CRON_SECRET`**, which already exists in the Vercel Production environment because the daily cron needs it: `HKDF-SHA256` (Node `crypto.hkdfSync`), input = `CRON_SECRET`, salt = `etf-monitor2`,
   info = `ai-provider-keys/v1`, 32 bytes. Used only when `CRON_SECRET` has at least 24 characters. The derivation gives the two uses independent keys, so the cron bearer value is never the encryption key itself.
   Each row records which source encrypted it (`key_source`). Decryption uses the recorded source; if that source is no longer available (variable removed, or `CRON_SECRET` rotated) the stored key counts as not set and the user enters it again. Setting `AI_KEY_MASTER_KEY` later only affects keys saved afterwards. Re-encrypting old rows is out of scope.
   Trade-off, stated honestly: the default ties the stored keys to `CRON_SECRET`. Rotating that secret makes the stored keys unreadable (re-enter them). A dedicated `AI_KEY_MASTER_KEY` avoids that coupling; the code supports it from day one, so it is a later choice for the user with no code change.
   Honest limit: the master key and the database are both inside the same Vercel/Neon trust zone. Encryption protects backups,
   the Neon console, SQL dumps and a leaked read-only connection string; it does not protect against someone who can already run code in the deployment.
3. **Key material is the switch.** When neither source in §2 is available (no valid `AI_KEY_MASTER_KEY` and no `CRON_SECRET` of 24+ characters), `/admin/ai` shows no key field, only a note that stored keys
   are not enabled and that environment variables still work. On the current deployment the cron secret exists, so the field simply appears.
4. **Reading (`readApiKey`).** Precedence: stored key first, environment variable second, otherwise not set. `resolveActiveProvider`
   stays pure and synchronous (DEC-017; its `readApiKey` parameter keeps its shape). A new async step loads the keys before it is called:
   `loadProviderKeys(db, env)` in the new **`lib/ai/key-store.ts`** returns a map `providerId → string | null` for the providers that require
   a key, and `provider-deps.ts` builds the `readApiKey` closure from that map. A decryption or database failure for one provider counts as "no key"
   (`no_api_key`), logs only the closed code and the provider id (DEC-019 `[load-error]` style), and never falls through to an exception with the input in it.
5. **Boundary (DEC-017 §4, amended).** Three modules touch key material and no others:
   `key-status.ts` (only `process.env` reader for provider keys, unchanged; it also hands `key-store.ts` the raw material for §2 and exposes `storingEnabled()` returning a boolean),
   `key-store.ts` (the only module that encrypts, decrypts, reads or writes `ai_provider_keys`), `provider-deps.ts` (the only wiring module).
   The importers of `key-store` are exactly `provider-deps.ts` and `lib/config/ai-keys.ts`. An object holding a plaintext key never leaves `lib/ai/`;
   `app/` and `components/` receive key-free views (`set`/`not set`, `source: "stored" | "environment" | "none"`, `updatedAt`). No client component imports any of them.
6. **Writing (DEC-016 pattern).** Plain functions in `lib/config/ai-keys.ts` over `Db` (`saveProviderKey`, `clearProviderKey`), taking `encrypt` as a dependency so tests need no real master key. The server
   action is a thin caller. Validation: provider id must be in the catalogue and `requiresApiKey`; the key is trimmed, 8–512 characters, no whitespace or control characters;
   otherwise a closed error code (`unknown_provider`, `key_invalid`, `storing_disabled`, `write_failed`). The result of an action never contains the key or the master key. The input is `type="password"`,
   `autocomplete="off"`, has no `defaultValue`, and is emptied after saving. Replacing is the same action as first saving; clearing removes the row (the environment variable, if any, then applies again).
7. **No key in any output.** No log line, error message, view model, snapshot, test output, HANDOVER line or QA file may contain a key or the master key. Tests use an obvious fake constant
   (`test-key-0000…`) and assert its absence from: the serialised view model, every `console` spy, every thrown message, the action result. The rule for tests is the same as for code.
8. **Providers come from presets only.** A base URL is fixed in the adapter/catalogue code (DEC-017 §3). The save action does not read any URL field from the form, and a test posts a `baseUrl`
   field and proves it is ignored. **A free-form or custom base URL is not allowed** (unless the user later asks for it): it would let anyone who reaches the page send the stored key to their own server. Adding a provider means a catalogue
   entry plus adapter code, as today (US-041 adds presets, not URLs).
9. **The chat never handles keys.** No capability reads or writes `ai_provider_keys`, and the chat does not accept a key in a message (it would enter chat history and the provider request). A message that asks
   to set a key gets a fixed reply pointing to `/admin/ai`. This is a test in the configuration capability.
10. **Agents still never see keys.** AGENTS.md "Secrets" gets one exception and three additions (edited by the Technical Lead now; the exception applies from US-040): keys may also be stored encrypted by the app;
    `AI_KEY_MASTER_KEY`, the derived encryption key, `CRON_SECRET` and the table `ai_provider_keys` are secrets like `.env*`: never select from it, never print it, never seed it; the QA loop uses fake keys only and never asks the user to paste a real key into a test.
11. **Small mitigations** (US-040): `/admin` and `/chat` send `robots: noindex`; the server action relies on Next's same-origin check for actions (no extra CORS). No rate limiter is built.

## User steps
- **None.** The table is created by the migration the deploy applies (DEC-023); the encryption key is derived from the `CRON_SECRET` that already exists (§2). Optional, only if you ever want the stored keys independent of the cron secret: set `AI_KEY_MASTER_KEY` (`openssl rand -base64 32`) in Vercel; keys saved afterwards use it.
- **Accepted 2026-09-28, recorded here (not a step, not to be raised again):** anyone who knows the address can replace the key or use its quota through the chat.

## Consequences
- `lib/ai/provider-deps.ts` becomes async at the outer edge only; `resolve.ts` and the adapters do not change.
- The admin AI page shows per provider: requires key, source (stored / environment / none), status, and a write-only field plus "Clear stored key".
- A missing `ai_provider_keys` table (42P01) is treated as no stored keys, like DEC-019 does for `etf_report_links`; a `/health` note names the missing table.
- Tests: encrypt/decrypt round trip, tamper and wrong-AAD rejection, wrong key, derivation is deterministic and differs from the raw `CRON_SECRET`, `AI_KEY_MASTER_KEY` wins over the derived key for new writes while old rows still decrypt by `key_source`, a `CRON_SECRET` shorter than 24 characters disables storing, precedence stored > env > none, closed error codes, absence of the fake key in every output, ignored `baseUrl`, storing-disabled state, chat refusal. No network, no real key or secret (test constants only).
