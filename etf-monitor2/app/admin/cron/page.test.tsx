import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import ro from "../../../messages/ro.json";
import type { Locale } from "@/i18n/locale";
import type { LastRun } from "@/lib/admin/operations";

let mockGetCronHour: () => Promise<number | null>;
let mockEffectiveSchedule: () => string | null;
let mockLastRun: () => Promise<LastRun | null>;

vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/config/default-deps", () => ({ createDbDeps: () => ({ db: {}, run: vi.fn() }) }));
vi.mock("@/lib/config/cron", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/config/cron")>();
  return {
    ...original,
    getCronHour: () => mockGetCronHour(),
    effectiveSchedule: () => mockEffectiveSchedule(),
  };
});
vi.mock("@/lib/admin/operations", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/admin/operations")>();
  return { ...original, loadLastRun: () => mockLastRun() };
});
vi.mock("./actions", () => ({ saveCronHourAction: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function renderPage(locale: Locale, messages: typeof ro | typeof en) {
  const { default: Page } = await import("./page");
  const element = await Page();
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {element}
    </NextIntlClientProvider>,
  );
}

function setup(overrides: { hour?: number | null; lastRun?: LastRun | null; schedule?: string | null } = {}) {
  mockGetCronHour = async () => (overrides.hour === undefined ? null : overrides.hour);
  mockLastRun = async () => (overrides.lastRun === undefined ? null : overrides.lastRun);
  mockEffectiveSchedule = () => (overrides.schedule === undefined ? "0 10 * * *" : overrides.schedule);
}

describe("Cron settings admin page (CG)", () => {
  it("CG-1: a saved hour is the effective hour, shown in UTC and as Bucharest time, with no default note", async () => {
    setup({ hour: 7 });
    const html = await renderPage("en", en);
    expect(html).toContain('data-cron-effective="7"');
    expect(html).toContain("07:00 UTC");
    expect(html).not.toContain("data-cron-default");
    expect(html).toMatch(/<option value="7" selected="">07:00 UTC — \d\d:00 Bucharest<\/option>/);
  });

  it("CG-2: no saved hour means the default 10 UTC is shown and selected, with the default note", async () => {
    setup({ hour: null });
    const html = await renderPage("en", en);
    expect(html).toContain('data-cron-effective="10"');
    expect(html).toContain("data-cron-default");
    expect(html).toContain(en.Admin.cron.defaultNote.replace("{utc}", "10:00"));
    expect(html).toMatch(/<option value="10" selected="">/);
  });

  it("CG-3: the form has exactly 24 hour options (0..23, no empty/clear option) and a single `hour` field", async () => {
    setup();
    const html = await renderPage("en", en);
    const values = [...html.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]);
    expect(values).toEqual(Array.from({ length: 24 }, (_, i) => String(i)));
    const names = [...html.matchAll(/<(?:input|select)[^>]*\bname="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(names)).toEqual(new Set(["hour"]));
  });

  it("CG-4: the old paste-into-vercel.json instructions are gone from both pages and both catalogues", async () => {
    setup({ hour: 7 });
    for (const [locale, messages] of [["en", en], ["ro", ro]] as const) {
      const html = await renderPage(locale, messages);
      expect(html).not.toContain("vercel.json");
      expect(html).not.toContain("data-cron-notice");
      expect(html).not.toContain('"schedule"');
    }
    for (const catalogue of [en, ro]) {
      for (const removed of ["effectiveWindow", "unrecognisedSchedule", "notSetOption", "changeNotice", "changeNoticeSteps", "hobbyNote"]) {
        expect(removed in catalogue.Admin.cron).toBe(false);
      }
      expect("cronCleared" in catalogue.Admin.messages).toBe(false);
    }
  });

  it("CG-5: the hourly-ping explanation and the once-per-UTC-day rule are shown in both locales", async () => {
    setup();
    for (const [locale, messages] of [["en", en], ["ro", ro]] as const) {
      const html = await renderPage(locale, messages);
      expect(html).toContain(messages.Admin.cron.pingHeading);
      expect(html).toContain("/api/cron/daily");
      expect(html).toContain(messages.Admin.cron.pingRule);
    }
  });

  it("CG-6: the Vercel safety-net hour comes from vercel.json when it is a once-a-day schedule, and is omitted otherwise", async () => {
    setup({ schedule: "0 10 * * *" });
    expect(await renderPage("en", en)).toContain(en.Admin.cron.safetyNet.replace("{utc}", "10:00"));
    setup({ schedule: "*/30 * * * *" });
    expect(await renderPage("en", en)).not.toContain("safety net");
    setup({ schedule: null });
    expect(await renderPage("en", en)).not.toContain("safety net");
  });

  it("CG-7: the latest run is shown with its localized status and Bucharest start time, or a none message", async () => {
    setup({ lastRun: { startedAt: "2026-10-09T10:05:00Z", finishedAt: "2026-10-09T10:06:00Z", status: "partial" } });
    const enHtml = await renderPage("en", en);
    expect(enHtml).toContain("2026-10-09 13:05");
    expect(enHtml).toContain(en.Admin.operations.runStatus.partial);
    const roHtml = await renderPage("ro", ro);
    expect(roHtml).toContain("09.10.2026 13:05");
    expect(roHtml).toContain(ro.Admin.operations.runStatus.partial);

    setup({ lastRun: null });
    expect(await renderPage("en", en)).toContain(en.Admin.cron.lastRunNone);
  });

  it("CG-8: no log text or other run field beyond started time and status reaches the page", async () => {
    setup({ lastRun: { startedAt: "2026-10-09T10:05:00Z", finishedAt: null, status: "running" } });
    const html = await renderPage("en", en);
    expect(html).not.toContain("etfs_processed");
    expect(html).not.toContain("errors_count");
  });

  it("CG-9: a failing read gives the translated load error only, no secret text, no form", async () => {
    setup();
    mockGetCronHour = async () => {
      throw new Error("connection refused: ******db.example.com/etfs");
    };
    const html = await renderPage("en", en);
    expect(html).toContain(en.Admin.cron.loadError);
    expect(html).not.toContain("connection refused");
    expect(html).not.toContain("postgres://");
    expect(html).not.toContain("<form");
  });

  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("LE-P9 (%s): a sentinel-bearing error renders the same HTML as a generic one and logs exactly one safe admin/cron line", async (locale, messages) => {
    setup();
    const SENTINEL = "******host/db";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockGetCronHour = async () => {
      const err = Object.assign(new Error(`connection refused ${SENTINEL}`), { name: "NeonDbError", code: "ECONNREFUSED" });
      throw err;
    };
    const sentinelHtml = await renderPage(locale, messages);
    const lines = spy.mock.calls.filter((c) => typeof c[0] === "string" && c[0].startsWith("[load-error]"));

    mockGetCronHour = async () => {
      throw new Error("x");
    };
    const genericHtml = await renderPage(locale, messages);
    spy.mockRestore();

    expect(sentinelHtml).toBe(genericHtml);
    expect(sentinelHtml).toContain(messages.Admin.cron.loadError);
    expect(sentinelHtml).not.toContain("SENTINELPW");
    expect(lines).toHaveLength(1);
    expect(lines[0][0]).toMatch(/^\[load-error\] admin\/cron /);
  });

  it("CG-10: ro/en render translated text and never the other locale's differing text", async () => {
    setup({ hour: 7 });
    const enHtml = await renderPage("en", en);
    const roHtml = await renderPage("ro", ro);
    expect(enHtml).toContain(en.Admin.cron.pingHeading);
    expect(roHtml).toContain(ro.Admin.cron.pingHeading);
    expect(roHtml).not.toContain(en.Admin.cron.heading);
    expect(enHtml).not.toContain(ro.Admin.cron.heading);
  });

  it("CG-11: exports force-dynamic", async () => {
    const mod = await import("./page");
    expect(mod.dynamic).toBe("force-dynamic");
  });

  it("CG-12: no network call while rendering", async () => {
    setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await renderPage("en", en);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
