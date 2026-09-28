import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import ro from "../../messages/ro.json";
import type { Locale } from "@/i18n/locale";

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

describe("Health page failure paths (US-031 AC4)", () => {
  beforeEach(() => {
    mockLocale = "ro";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("HP-F1 (%s): getDb() throwing MissingDatabaseUrlError renders the failure state without throwing", async (locale, messages) => {
    mockLocale = locale;
    const { MissingDatabaseUrlError } = await import("@/lib/db");
    getDbImpl = () => {
      throw new MissingDatabaseUrlError();
    };

    const html = await renderHealthPage();

    expect(html).toContain(messages.Health.dbUnreachable);
    expect(html).toContain("DATABASE_URL is not set");
    expect(html).not.toContain(messages.Health.dbConnected);
  });

  it.each([
    ["ro", ro] as const,
    ["en", en] as const,
  ])("HP-F2 (%s): a query that never settles renders the timeout state after HEALTH_QUERY_TIMEOUT_MS", async (locale, messages) => {
    mockLocale = locale;
    vi.useFakeTimers();
    const { HEALTH_QUERY_TIMEOUT_MS } = await import("@/lib/health");
    getDbImpl = () => ({
      select: () => ({
        from: () => new Promise(() => undefined),
      }),
    });

    const promise = renderHealthPage();
    await vi.advanceTimersByTimeAsync(HEALTH_QUERY_TIMEOUT_MS);
    const html = await promise;

    expect(html).toContain(messages.Health.dbUnreachable);
    expect(html).toContain(messages.Health.dbTimeout);
    expect(html).not.toContain(messages.Health.dbConnected);
    expect(html).not.toContain("Error:");
    expect(html).not.toContain("Eroare:");
  });
});
