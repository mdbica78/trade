import en from "../../messages/en.json";
import ro from "../../messages/ro.json";
import { locales, LOCALE_COOKIE, type Locale } from "../../i18n/locale";

/** Above a cold function start plus a Neon wake-up, and below the 60s `maxDuration` of `/chat`, so a hung page is reported here before Vercel returns 504 (US-031 plan section 4). */
export const SMOKE_REQUEST_TIMEOUT_MS = 30_000;

export const SMOKE_LOCALES = locales;

const messagesByLocale = { ro, en } as const;

type MessageKey = string;

export type SmokePage = {
  path: string;
  failureKeys: readonly MessageKey[];
  noteKeys?: readonly MessageKey[];
};

/**
 * Public pages only, no `/api/` path and no Server Action (requirements §6, AGENTS.md "Never …
 * deploy" — this list is what any anonymous visitor can already reach). `Admin.cron.unrecognisedSchedule`
 * counts as a failure text for `/admin/cron`: the committed `vercel.json` is pinned once-a-day, so
 * seeing it live means the deployment and the repo disagree.
 */
export const SMOKE_PAGES: readonly SmokePage[] = [
  { path: "/", failureKeys: ["Home.loadError"] },
  { path: "/etf/BTBETRETF", failureKeys: ["EtfDetail.loadError"] },
  {
    path: "/chat",
    failureKeys: ["Chat.loadError"],
    noteKeys: [
      "Chat.replies.unavailableNotConfigured",
      "Chat.replies.unavailableUnknownProvider",
      "Chat.replies.unavailableNotImplemented",
      "Chat.replies.unavailableNoApiKey",
      "Chat.replies.unavailableNoModel",
    ],
  },
  { path: "/health", failureKeys: ["Health.dbUnreachable"] },
  { path: "/admin", failureKeys: [] },
  { path: "/admin/etfs", failureKeys: ["Admin.etfs.loadError"] },
  { path: "/admin/etfs/BTBETRETF/fields", failureKeys: ["Admin.fields.loadError"] },
  { path: "/admin/ai", failureKeys: ["Admin.ai.loadError"] },
  { path: "/admin/cron", failureKeys: ["Admin.cron.loadError", "Admin.cron.unrecognisedSchedule"] },
  { path: "/admin/operations", failureKeys: ["Admin.operations.loadError"] },
];

function resolveMessage(locale: Locale, key: MessageKey): string {
  const dict = messagesByLocale[locale] as unknown as Record<string, unknown>;
  const raw = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], dict);
  if (typeof raw !== "string" || raw.length === 0 || raw.includes("{")) {
    throw new Error(`smoke: message key "${key}" does not resolve to a plain string for locale "${locale}"`);
  }
  return raw;
}

const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1"]);

export type ParsedBaseUrl = { ok: true; origin: string } | { ok: false };

/** Accepts `https://` for any host, and `http://` only for `localhost` / `127.0.0.1` (a locally served app). Rejects credentials, a non-root path, a query or a hash. */
export function parseBaseUrl(arg: string | undefined): ParsedBaseUrl {
  if (!arg) {
    return { ok: false };
  }
  let url: URL;
  try {
    url = new URL(arg);
  } catch {
    return { ok: false };
  }
  if (url.username || url.password) {
    return { ok: false };
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    return { ok: false };
  }
  if (url.search || url.hash) {
    return { ok: false };
  }
  if (url.protocol === "https:") {
    return { ok: true, origin: url.origin };
  }
  if (url.protocol === "http:" && ALLOWED_HOSTS.has(url.hostname)) {
    return { ok: true, origin: url.origin };
  }
  return { ok: false };
}

export function buildRequest(origin: string, path: string, locale: Locale): { url: string; init: RequestInit } {
  return {
    url: `${origin}${path}`,
    init: {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: {
        accept: "text/html",
        cookie: `${LOCALE_COOKIE}=${locale}`,
        "user-agent": "etf-monitor2-smoke/0.1",
      },
    },
  };
}

/** Strips `<script>…</script>` elements (case-insensitive), so a match against the RSC payload (which holds every translated message on every page, US-031 plan risk R1) doesn't produce a false failure. */
export function visibleMarkup(html: string): string {
  return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
}

export function htmlLang(html: string): string | null {
  const match = /<html[^>]*\blang="([^"]*)"/i.exec(html);
  return match ? match[1] : null;
}

function escapeForHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");
}

/** Matches a text in its raw form or its React-escaped form (`&#x27;`, `&quot;`, `&amp;`). */
export function containsText(markup: string, text: string): boolean {
  return markup.includes(text) || markup.includes(escapeForHtml(text));
}

export type SmokeFailureReason =
  | "http-status"
  | "redirect"
  | "timeout"
  | "network"
  | "wrong-lang"
  | `error-text:${string}`;

export type SmokeResult = {
  verdict: "PASS" | "FAIL";
  locale: Locale;
  path: string;
  status: number | null;
  reason?: SmokeFailureReason;
  note?: string;
};

type PageOutcome = { status: number; headers: Headers; body: string } | { error: "network" | "timeout" };

export function checkPage(outcome: PageOutcome, page: SmokePage, locale: Locale): SmokeResult {
  const base = { locale, path: page.path };

  if ("error" in outcome) {
    return { ...base, verdict: "FAIL", status: null, reason: outcome.error };
  }

  if (outcome.status >= 300 && outcome.status < 400) {
    return { ...base, verdict: "FAIL", status: outcome.status, reason: "redirect" };
  }
  if (outcome.status !== 200) {
    return { ...base, verdict: "FAIL", status: outcome.status, reason: "http-status" };
  }

  const lang = htmlLang(outcome.body);
  if (lang !== locale) {
    return { ...base, verdict: "FAIL", status: outcome.status, reason: "wrong-lang" };
  }

  const markup = visibleMarkup(outcome.body);

  for (const key of page.failureKeys) {
    const text = resolveMessage(locale, key);
    if (containsText(markup, text)) {
      return { ...base, verdict: "FAIL", status: outcome.status, reason: `error-text:${key}` };
    }
  }

  for (const key of page.noteKeys ?? []) {
    const text = resolveMessage(locale, key);
    if (containsText(markup, text)) {
      return { ...base, verdict: "PASS", status: outcome.status, note: key };
    }
  }

  return { ...base, verdict: "PASS", status: outcome.status };
}

export function formatLine(result: SmokeResult): string {
  const status = result.status === null ? "-" : String(result.status);
  const suffix = result.reason ? ` ${result.reason}` : result.note ? ` note=${result.note}` : "";
  return `${result.verdict} ${result.locale} ${result.path} ${status}${suffix}`;
}

export type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

async function requestPage(fetchImpl: FetchImpl, url: string, init: RequestInit): Promise<PageOutcome> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, SMOKE_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal });
    const body = await res.text();
    return { status: res.status, headers: res.headers, body };
  } catch {
    return { error: timedOut ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

export type RunDeploySmokeResult = { lines: string[]; exitCode: 0 | 1 | 2 };

/** Read-only: GET requests only, to the given origin only, no body ever printed (AGENTS.md, requirements §6). */
export async function runDeploySmoke(argv: readonly string[], deps: { fetchImpl: FetchImpl }): Promise<RunDeploySmokeResult> {
  if (argv.length !== 1) {
    return { lines: ["usage: smoke:deploy <baseUrl>"], exitCode: 2 };
  }
  const parsed = parseBaseUrl(argv[0]);
  if (!parsed.ok) {
    return { lines: ["usage: smoke:deploy <baseUrl>"], exitCode: 2 };
  }

  const lines: string[] = [];
  let passed = 0;
  let total = 0;

  for (const page of SMOKE_PAGES) {
    for (const locale of SMOKE_LOCALES) {
      total += 1;
      const { url, init } = buildRequest(parsed.origin, page.path, locale);
      const outcome = await requestPage(deps.fetchImpl, url, init);
      const result = checkPage(outcome, page, locale);
      if (result.verdict === "PASS") {
        passed += 1;
      }
      lines.push(formatLine(result));
    }
  }

  lines.push(`SUMMARY ${passed}/${total} passed`);
  return { lines, exitCode: passed === total ? 0 : 1 };
}
