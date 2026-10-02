import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import ro from "../../messages/ro.json";
import type { Locale } from "@/i18n/locale";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { pgliteDb } from "../../test/helpers/pglite-drizzle";

let mockLocale: Locale = "ro";
let getDbImpl: () => unknown = () => ({});

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return { ...actual, getDb: () => getDbImpl() };
});

vi.mock("next-intl/server", () => {
  const catalogues = { ro, en };
  return {
    getLocale: async () => mockLocale,
    getTranslations: async (namespace: string) => {
      const dict = catalogues[mockLocale][namespace as keyof typeof ro] as Record<string, unknown>;
      return (key: string, values?: Record<string, string>) => {
        const raw = key
          .split(".")
          .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], dict) as string;
        return values
          ? Object.entries(values).reduce((s, [k, v]) => s.replace(`{${k}}`, v), raw)
          : raw;
      };
    },
  };
});

async function renderHealthPage() {
  const { default: HealthPage } = await import("./page");
  const element = await HealthPage();
  return renderToStaticMarkup(element);
}

describe("Health page schema-drift rendering over real PGlite (AC3)", () => {
  let empty: EmptyTestDatabase;

  beforeEach(async () => {
    mockLocale = "ro";
    empty = await createEmptyTestDatabase();
  }, 60_000);

  afterEach(async () => {
    await empty.close();
  });

  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("HP-S1 (%s): a dropped report-link table shows the stale-schema warning", async (locale, messages) => {
    mockLocale = locale;
    await empty.pg.exec(`drop table "etf_report_links"`);
    getDbImpl = () => pgliteDb(empty.pg);

    const html = await renderHealthPage();

    expect(html).toContain(messages.Health.schemaStale);
    expect(html).toContain('<li data-missing-table="etf_report_links">');
    const matches = [...html.matchAll(/data-missing-table="([^"]*)"/g)];
    for (const m of matches) {
      expect(m[1]).toMatch(/^[a-z_][a-z0-9_]*$/);
    }
    expect(html).toContain(messages.Health.dbConnected);
  }, 60_000);

  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("HP-S3 (%s): a missing provider-key table is named without reading its rows", async (locale, messages) => {
    mockLocale = locale;
    await empty.pg.exec(`drop table "ai_provider_keys"`);
    getDbImpl = () => pgliteDb(empty.pg);

    const html = await renderHealthPage();

    expect(html).toContain(messages.Health.schemaStale);
    expect(html).toContain('<li data-missing-table="ai_provider_keys">');
    expect(html).toContain(messages.Health.dbConnected);
  }, 60_000);

  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("HP-S2 (%s): a fully migrated schema shows no warning", async (locale, messages) => {
    mockLocale = locale;
    getDbImpl = () => pgliteDb(empty.pg);

    const html = await renderHealthPage();

    expect(html).not.toContain(messages.Health.schemaStale);
    expect(html).not.toContain("data-missing-table");
  }, 60_000);
});
