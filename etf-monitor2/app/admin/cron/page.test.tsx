import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import ro from "../../../messages/ro.json";
import type { Locale } from "@/i18n/locale";

let mockGetCronHour: () => Promise<number | null>;
let mockEffectiveSchedule: () => string | null;

vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/config/default-deps", () => ({ createCronConfigDeps: () => ({}) }));
vi.mock("@/lib/config/cron", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/config/cron")>();
  return {
    ...original,
    getCronHour: () => mockGetCronHour(),
    effectiveSchedule: () => mockEffectiveSchedule(),
  };
});
vi.mock("./actions", () => ({ saveCronHourAction: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function renderPage(locale: Locale, messages: typeof ro | typeof en) {
  const { default: Page } = await import("./page");
  const element = await Page();
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {element}
    </NextIntlClientProvider>,
  );
}

describe("Cron settings admin page (CG)", () => {
  it("CG-1: effective window shown from the real vercel.json (0 10 * * * -> 10:00-10:59 UTC), match means no notice", async () => {
    mockEffectiveSchedule = () => "0 10 * * *";
    mockGetCronHour = async () => 10;
    const html = await renderPage("en", en);
    expect(html).toMatch(/data-cron-effective="ok"[^>]*>[^<]*10:00–10:59 UTC/);
    expect(html).not.toContain("data-cron-notice");
  });

  it("CG-2: a mismatch shows the notice with the exact escaped vercel.json line and both notice strings", async () => {
    mockEffectiveSchedule = () => "0 10 * * *";
    mockGetCronHour = async () => 7;
    const html = await renderPage("en", en);
    expect(html).toContain("data-cron-notice");
    expect(html).toContain(escapeHtml('"schedule": "0 7 * * *"'));
    expect(html).toContain("07:00");
    expect(html).toContain(en.Admin.cron.changeNoticeSteps);
  });

  it("CG-3: no stored hour means no notice", async () => {
    mockEffectiveSchedule = () => "0 10 * * *";
    mockGetCronHour = async () => null;
    const html = await renderPage("en", en);
    expect(html).not.toContain("data-cron-notice");
    expect(html).toContain(en.Admin.cron.notSetOption);
  });

  it("CG-4: an unrecognised schedule shows the raw string verbatim, no HH:00-HH:59 window in the effective element", async () => {
    mockEffectiveSchedule = () => "*/30 * * * *";
    mockGetCronHour = async () => null;
    const html = await renderPage("en", en);
    expect(html).toMatch(/data-cron-effective="unrecognised"/);
    expect(html).toContain(en.Admin.cron.unrecognisedSchedule);
    expect(html).toContain("<code>*/30 * * * *</code>");
    const effectiveMatch = html.match(/<p data-cron-effective="unrecognised">[\s\S]*?<\/p>/);
    expect(effectiveMatch?.[0]).not.toMatch(/\d{2}:00–\d{2}:59/);
  });

  it("CG-4b: no matching cron entry (null) shows the message with no <code>", async () => {
    mockEffectiveSchedule = () => null;
    mockGetCronHour = async () => null;
    const html = await renderPage("en", en);
    expect(html).toMatch(/data-cron-effective="unrecognised"/);
    expect(html).not.toContain("<code>");
  });

  it("CG-4c: unrecognised effective schedule with a desired hour still shows the notice", async () => {
    mockEffectiveSchedule = () => "*/30 * * * *";
    mockGetCronHour = async () => 7;
    const html = await renderPage("en", en);
    expect(html).toContain("data-cron-notice");
  });

  it("CG-5: desired hour 0 produces the exact line with 0", async () => {
    mockEffectiveSchedule = () => "0 10 * * *";
    mockGetCronHour = async () => 0;
    const html = await renderPage("en", en);
    expect(html).toContain(escapeHtml('"schedule": "0 0 * * *"'));
  });

  it("CG-6: getCronHour throwing gives the translated load error, keeps the effective window, no secret text", async () => {
    mockEffectiveSchedule = () => "0 10 * * *";
    mockGetCronHour = async () => {
      throw new Error("connection refused: postgres://user:secret@db.example.com/etfs");
    };
    const html = await renderPage("en", en);
    expect(html).toContain(en.Admin.cron.loadError);
    expect(html).toContain("10:00");
    expect(html).not.toContain("connection refused");
    expect(html).not.toContain("postgres://");
    expect(html).not.toContain("secret");
    expect(html).not.toContain("data-cron-notice");
  });

  it("CG-7: the hour select has exactly 25 options, none, then 0..23 in order", async () => {
    mockEffectiveSchedule = () => "0 10 * * *";
    mockGetCronHour = async () => null;
    const html = await renderPage("en", en);
    const values = [...html.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]);
    expect(values).toEqual(["", ...Array.from({ length: 24 }, (_, i) => String(i))]);
    const names = [...html.matchAll(/<(?:input|select)[^>]*\bname="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(names)).toEqual(new Set(["hour"]));
  });

  it("CG-8: ro/en render translated notes, never leak the other locale's differing text", async () => {
    mockEffectiveSchedule = () => "0 10 * * *";
    mockGetCronHour = async () => 7;
    const enHtml = await renderPage("en", en);
    const roHtml = await renderPage("ro", ro);
    expect(enHtml).toContain(en.Admin.cron.hobbyNote);
    expect(roHtml).toContain(ro.Admin.cron.hobbyNote);
    expect(roHtml).not.toContain(en.Admin.cron.heading);
    expect(enHtml).not.toContain(ro.Admin.cron.heading);
    expect(enHtml).toContain(escapeHtml('"schedule": "0 7 * * *"'));
    expect(roHtml).toContain(escapeHtml('"schedule": "0 7 * * *"'));
  });

  it("CG-9: exports force-dynamic", async () => {
    const mod = await import("./page");
    expect(mod.dynamic).toBe("force-dynamic");
  });

  it("CG-10: no network call while rendering", async () => {
    mockEffectiveSchedule = () => "0 10 * * *";
    mockGetCronHour = async () => 10;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await renderPage("en", en);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
