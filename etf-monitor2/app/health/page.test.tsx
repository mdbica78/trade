import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";
import en from "../../messages/en.json";
import ro from "../../messages/ro.json";
import type { Locale } from "@/i18n/locale";
import type { HealthStatus } from "@/lib/health";

let mockLocale: Locale = "ro";
let mockStatus: HealthStatus = { dbConnected: true, etfCount: 3, fieldCatalogCount: 8 };

vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/health", () => ({ getHealthStatus: () => mockStatus }));

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

describe("Health page", () => {
  beforeEach(() => {
    mockLocale = "ro";
    mockStatus = { dbConnected: true, etfCount: 3, fieldCatalogCount: 8 };
  });

  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("renders connected counts with %s labels", async (locale, messages) => {
    mockLocale = locale;
    const html = await renderHealthPage();

    expect(html).toContain(messages.Health.title);
    expect(html).toContain(messages.Health.dbConnected);
    expect(html).toContain(messages.Health.etfCount);
    expect(html).toContain(">3<");
    expect(html).toContain(messages.Health.fieldCatalogCount);
    expect(html).toContain(">8<");
    expect(html).toContain(messages.Health.localeName[locale]);
  });

  it("renders a visible failure state, not a crash, when the database is unreachable", async () => {
    mockStatus = { dbConnected: false, error: "connection refused" };
    const html = await renderHealthPage();

    expect(html).toContain(ro.Health.dbUnreachable);
    expect(html).toContain("connection refused");
    expect(html).not.toContain(ro.Health.dbConnected);
  });
});
