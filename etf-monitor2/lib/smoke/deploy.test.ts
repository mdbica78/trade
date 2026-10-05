import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import ro from "../../messages/ro.json";
import { seedEtfs } from "../db/seed-data";
import { extractModuleSpecifiers } from "../../test/helpers/module-specifiers";
import { locales } from "../../i18n/locale";
import {
  buildRequest,
  checkPage,
  containsText,
  formatLine,
  htmlLang,
  parseBaseUrl,
  runDeploySmoke,
  SMOKE_PAGES,
  SMOKE_REQUEST_TIMEOUT_MS,
  visibleMarkup,
  type FetchImpl,
} from "./deploy";

function makeResponse(init: { status?: number; body?: string; headers?: Record<string, string> } = {}): Response {
  const headers = new Headers(init.headers ?? {});
  return {
    status: init.status ?? 200,
    headers,
    text: async () => init.body ?? "",
  } as unknown as Response;
}

describe("SM-1..SM-14: deployment smoke script", () => {
  it("SM-1: every request is GET, no body, redirect manual, same origin; page list x locales gives 20 requests in order", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl: FetchImpl = async (url, init) => {
      calls.push({ url, init });
      return makeResponse({ body: `<html lang="${(init.headers as Record<string, string>).cookie.split("=")[1]}"></html>` });
    };

    await runDeploySmoke(["https://example.vercel.app"], { fetchImpl });

    expect(calls.length).toBe(SMOKE_PAGES.length * locales.length);
    expect(calls.length).toBe(20);
    for (const call of calls) {
      expect(call.init.method).toBe("GET");
      expect(call.init.body).toBeUndefined();
      expect(call.init.redirect).toBe("manual");
      expect(new URL(call.url).origin).toBe("https://example.vercel.app");
    }
    const expectedOrder = SMOKE_PAGES.flatMap((page) => locales.map((locale) => `${page.path}|${locale}`));
    const actualOrder = calls.map((c) => {
      const u = new URL(c.url);
      const cookie = (c.init.headers as Record<string, string>).cookie;
      return `${u.pathname}|${cookie.split("=")[1]}`;
    });
    expect(actualOrder).toEqual(expectedOrder);
  });

  it("SM-2: a cross-origin redirect fails as `redirect`, called once and not followed; a same-origin 307 also fails as `redirect`", () => {
    const crossOrigin = checkPage(
      { status: 302, body: "" },
      SMOKE_PAGES[0]!,
      "en",
    );
    expect(crossOrigin.verdict).toBe("FAIL");
    expect(crossOrigin.reason).toBe("redirect");

    const sameOrigin307 = checkPage(
      { status: 307, body: "" },
      SMOKE_PAGES[0]!,
      "en",
    );
    expect(sameOrigin307.verdict).toBe("FAIL");
    expect(sameOrigin307.reason).toBe("redirect");
  });

  it("SM-2b: fetchImpl is called exactly once for a redirecting page (not followed)", async () => {
    const fetchImpl = vi.fn(async () => makeResponse({ status: 302, headers: { location: "https://evil.example/" } }));
    await runDeploySmoke(["https://example.vercel.app"], { fetchImpl });
    // Each page/locale is one call; a redirect does not trigger a follow-up call.
    expect(fetchImpl).toHaveBeenCalledTimes(SMOKE_PAGES.length * locales.length);
  });

  it("SM-3: no /api/ path, every path starts with /; headers are exactly accept/cookie/user-agent, no authorization or next-action; cookie is NEXT_LOCALE=<locale>", () => {
    for (const page of SMOKE_PAGES) {
      expect(page.path.includes("/api/")).toBe(false);
      expect(page.path.startsWith("/")).toBe(true);
    }
    const { init } = buildRequest("https://example.vercel.app", "/", "ro");
    const headers = init.headers as Record<string, string>;
    expect(Object.keys(headers).sort()).toEqual(["accept", "cookie", "user-agent"]);
    expect(headers.authorization).toBeUndefined();
    expect(headers["next-action"]).toBeUndefined();
    expect(headers.cookie).toBe("NEXT_LOCALE=ro");
  });

  it("SM-4: a page passes only on 200 + matching <html lang> + none of its failure texts; each failure is independent", () => {
    const page = SMOKE_PAGES.find((p) => p.path === "/")!;
    const ok = checkPage({ status: 200, body: `<html lang="en"></html>` }, page, "en");
    expect(ok.verdict).toBe("PASS");

    const missingLang = checkPage({ status: 200, body: `<html></html>` }, page, "en");
    expect(missingLang.verdict).toBe("FAIL");
    expect(missingLang.reason).toBe("wrong-lang");

    const wrongLang = checkPage({ status: 200, body: `<html lang="en"></html>` }, page, "ro");
    expect(wrongLang.verdict).toBe("FAIL");
    expect(wrongLang.reason).toBe("wrong-lang");

    const failureText = checkPage(
      { status: 200, body: `<html lang="en"><p role="alert">${en.Home.loadError}</p></html>` },
      page,
      "en",
    );
    expect(failureText.verdict).toBe("FAIL");
    expect(failureText.reason).toBe("error-text:Home.loadError");
  });

  it("SM-5: failure texts come from messages/<locale>.json, every key resolves to a non-empty string with no ICU argument", () => {
    for (const page of SMOKE_PAGES) {
      for (const key of [...page.failureKeys, ...(page.noteKeys ?? [])]) {
        for (const [locale, dict] of [["ro", ro] as const, ["en", en] as const]) {
          const raw = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], dict as Record<string, unknown>);
          expect(typeof raw).toBe("string");
          expect((raw as string).length).toBeGreaterThan(0);
          expect(raw as string).not.toContain("{");
          void locale;
        }
      }
    }

    const homePage = SMOKE_PAGES.find((p) => p.path === "/")!;
    const failEn = checkPage(
      { status: 200, body: `<html lang="en">${en.Home.loadError}</html>` },
      homePage,
      "en",
    );
    expect(failEn.verdict).toBe("FAIL");
    const failRo = checkPage(
      { status: 200, body: `<html lang="ro">${ro.Home.loadError}</html>` },
      homePage,
      "ro",
    );
    expect(failRo.verdict).toBe("FAIL");
  });

  it("SM-6: failure text only inside <script> does not fail; the same text in the markup does", () => {
    const homePage = SMOKE_PAGES.find((p) => p.path === "/")!;
    const inScript = checkPage(
      {
        status: 200,
        body: `<html lang="en"><body><script>self.__next_f.push([1,${JSON.stringify(en.Home.loadError)}])</script></body></html>`,
      },
      homePage,
      "en",
    );
    expect(inScript.verdict).toBe("PASS");

    const inMarkup = checkPage(
      { status: 200, body: `<html lang="en"><p>${en.Home.loadError}</p></html>` },
      homePage,
      "en",
    );
    expect(inMarkup.verdict).toBe("FAIL");
  });

  it("SM-7: matches raw and React-escaped forms of a text containing ' \" &", () => {
    const text = `it's "quoted" & more`;
    expect(containsText(`<p>${text}</p>`, text)).toBe(true);
    const escaped = `it&#x27;s &quot;quoted&quot; &amp; more`;
    expect(containsText(`<p>${escaped}</p>`, text)).toBe(true);
    expect(containsText(`<p>unrelated</p>`, text)).toBe(false);
  });

  it(
    "SM-8: a 500 fails with exit code 1; a network rejection fails as `network`; a hanging fetch fails as `timeout` after the constant; all-pass gives exit 0",
    async () => {
      vi.useFakeTimers();
      try {
        const hangingFetch: FetchImpl = (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          });
        const promise = runDeploySmoke(["https://example.vercel.app"], { fetchImpl: hangingFetch });
        const requestCount = SMOKE_PAGES.length * locales.length;
        await vi.advanceTimersByTimeAsync(requestCount * SMOKE_REQUEST_TIMEOUT_MS);
        const outcome = await promise;
        expect(outcome.exitCode).toBe(1);
        expect(outcome.lines.every((l) => l.startsWith("FAIL") || l.startsWith("SUMMARY"))).toBe(true);
        expect(outcome.lines.some((l) => l.includes(" timeout"))).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    },
    20_000,
  );

  it("SM-8b: a 500 response and a network rejection", async () => {
    let call = 0;
    const fetchImpl: FetchImpl = async () => {
      call += 1;
      if (call === 1) {
        return makeResponse({ status: 500 });
      }
      throw new TypeError("network down");
    };
    const outcome = await runDeploySmoke(["https://example.vercel.app"], { fetchImpl });
    expect(outcome.exitCode).toBe(1);
    expect(outcome.lines[0]).toMatch(/^FAIL .* 500 http-status$/);
    expect(outcome.lines[1]).toMatch(/^FAIL .* - network$/);
  });

  it("SM-8c: every page passing gives exit code 0", async () => {
    const fetchImpl: FetchImpl = async (_url, init) => {
      const locale = (init.headers as Record<string, string>).cookie.split("=")[1];
      return makeResponse({ body: `<html lang="${locale}"></html>` });
    };
    const outcome = await runDeploySmoke(["https://example.vercel.app"], { fetchImpl });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.lines[outcome.lines.length - 1]).toBe("SUMMARY 20/20 passed");
  });

  it("SM-9: a sentinel string in the markup/lang/500 body/Location header never appears in any output line; reasons are from a closed vocabulary", async () => {
    const sentinel = "SUPER-SECRET-SENTINEL-VALUE";
    let call = 0;
    const fetchImpl: FetchImpl = async () => {
      call += 1;
      if (call === 1) return makeResponse({ body: `<html lang="${sentinel}"></html>` });
      if (call === 2) return makeResponse({ status: 500, body: sentinel });
      if (call === 3) return makeResponse({ status: 302, headers: { location: `https://${sentinel}.example/` } });
      throw new Error(sentinel);
    };
    const outcome = await runDeploySmoke(["https://example.vercel.app"], { fetchImpl });
    for (const line of outcome.lines) {
      expect(line).not.toContain(sentinel);
    }
    const closedVocabulary = /^(PASS|FAIL) (ro|en) \S+ (\d{3}|-)( (redirect|timeout|network|wrong-lang|http-status|error-text:\S+|note=\S+))?$/;
    for (const line of outcome.lines) {
      if (line.startsWith("SUMMARY")) continue;
      expect(line).toMatch(closedVocabulary);
    }
  });

  it("SM-10: an unconfigured /chat is not a failure (note), but Chat.loadError still fails", () => {
    const chatPage = SMOKE_PAGES.find((p) => p.path === "/chat")!;
    const noteResult = checkPage(
      { status: 200, body: `<html lang="en"><p>${en.Chat.replies.unavailableNoApiKey}</p></html>` },
      chatPage,
      "en",
    );
    expect(noteResult.verdict).toBe("PASS");
    expect(noteResult.note).toBe("Chat.replies.unavailableNoApiKey");

    const failResult = checkPage(
      { status: 200, body: `<html lang="en"><p>${en.Chat.loadError}</p></html>` },
      chatPage,
      "en",
    );
    expect(failResult.verdict).toBe("FAIL");
  });

  it("SM-11: base URL rule accepts https and localhost/127.0.0.1 http, rejects everything else with no request", async () => {
    expect(parseBaseUrl("https://etf-monitor2.vercel.app").ok).toBe(true);
    expect(parseBaseUrl("https://etf-monitor2.vercel.app/").ok).toBe(true);
    expect(parseBaseUrl("http://localhost:3000").ok).toBe(true);
    expect(parseBaseUrl("http://127.0.0.1:3000").ok).toBe(true);

    const rejected = [
      "http://example.com",
      "http://localhost.evil.com",
      "ftp://example.com",
      "https://u:p@host.example",
      "https://etf-monitor2.vercel.app/extra",
      "https://etf-monitor2.vercel.app?x=1",
      "https://etf-monitor2.vercel.app#hash",
      undefined,
      "garbage not a url",
    ];
    for (const arg of rejected) {
      expect(parseBaseUrl(arg).ok).toBe(false);
    }

    const fetchImpl = vi.fn();
    const noArg = await runDeploySmoke([], { fetchImpl });
    expect(noArg.exitCode).toBe(2);
    expect(noArg.lines).toHaveLength(1);
    expect(noArg.lines[0]).not.toContain("undefined");

    const twoArgs = await runDeploySmoke(["https://a.example", "https://b.example"], { fetchImpl });
    expect(twoArgs.exitCode).toBe(2);

    const garbage = await runDeploySmoke(["garbage not a url"], { fetchImpl });
    expect(garbage.exitCode).toBe(2);
    expect(garbage.lines[0]).not.toContain("garbage not a url");

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("SM-12: lib/smoke/deploy.ts and scripts/smoke-deploy.ts read no process.env and import no forbidden module; the CLI imports only ../lib/smoke/deploy", () => {
    const deploySource = readFileSync(path.join(__dirname, "deploy.ts"), "utf8");
    expect(deploySource).not.toContain("process.env");
    const forbidden = ["../db", "lib/db", "../cron", "lib/cron", "../ingestion", "lib/ingestion", "next", "@neondatabase/serverless"];
    const deploySpecifiers = extractModuleSpecifiers(deploySource);
    for (const specifier of deploySpecifiers) {
      for (const bad of forbidden) {
        expect(specifier.includes(bad)).toBe(false);
      }
    }

    const cliSource = readFileSync(path.join(__dirname, "..", "..", "scripts", "smoke-deploy.ts"), "utf8");
    expect(cliSource).not.toContain("process.env");
    const cliSpecifiers = extractModuleSpecifiers(cliSource);
    expect(cliSpecifiers).toEqual(["../lib/smoke/deploy"]);
  });

  it("SM-13: output shape is one line per page x locale then one summary line", async () => {
    const fetchImpl: FetchImpl = async (_url, init) => {
      const locale = (init.headers as Record<string, string>).cookie.split("=")[1];
      return makeResponse({ body: `<html lang="${locale}"></html>` });
    };
    const outcome = await runDeploySmoke(["https://example.vercel.app"], { fetchImpl });
    expect(outcome.lines).toHaveLength(21);
    for (const line of outcome.lines.slice(0, 20)) {
      expect(line).toMatch(/^(PASS|FAIL) (ro|en) \/\S* (\d{3}|-)( \S+)?$/);
    }
    expect(outcome.lines[20]).toMatch(/^SUMMARY \d+\/\d+ passed$/);
  });

  it("SM-14: package.json has the smoke:deploy script and README documents pnpm smoke:deploy", () => {
    const pkg = JSON.parse(readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8"));
    expect(pkg.scripts["smoke:deploy"]).toBe("tsx scripts/smoke-deploy.ts");
    const readme = readFileSync(path.join(__dirname, "..", "..", "README.md"), "utf8");
    expect(readme).toContain("pnpm smoke:deploy");
  });

  it("uses a seeded symbol for the ETF detail page (tech-lead point 3)", () => {
    const etfPage = SMOKE_PAGES.find((p) => p.path.startsWith("/etf/"))!;
    const symbol = etfPage.path.split("/etf/")[1];
    expect(seedEtfs.some((e) => e.symbol === symbol)).toBe(true);
  });

  it("htmlLang / visibleMarkup helpers behave as expected", () => {
    expect(htmlLang(`<html lang="ro" data-x><body/></html>`)).toBe("ro");
    expect(htmlLang(`<html><body/></html>`)).toBeNull();
    expect(visibleMarkup(`a<script>b</script>c<SCRIPT>d</SCRIPT>e`)).toBe("ace");
  });

  it("formatLine renders PASS/FAIL with reason or note", () => {
    expect(formatLine({ verdict: "PASS", locale: "en", path: "/", status: 200 })).toBe("PASS en / 200");
    expect(formatLine({ verdict: "FAIL", locale: "ro", path: "/health", status: 500, reason: "http-status" })).toBe(
      "FAIL ro /health 500 http-status",
    );
    expect(formatLine({ verdict: "PASS", locale: "en", path: "/chat", status: 200, note: "Chat.replies.unavailableNoApiKey" })).toBe(
      "PASS en /chat 200 note=Chat.replies.unavailableNoApiKey",
    );
  });
});
