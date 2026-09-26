import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import ro from "../../../messages/ro.json";
import type { Locale } from "@/i18n/locale";
import type { OperationsView } from "@/lib/admin/operations";

let mockLoad: () => Promise<OperationsView>;

vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/admin/operations", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/admin/operations")>();
  return { ...original, createOperationsLoader: () => () => mockLoad() };
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
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

const emptyView: OperationsView = { runs: [], etfs: [], parseErrors: [] };

describe("Operations admin page (OPG)", () => {
  it("OPG-6: the page exports dynamic = force-dynamic (never queries the database at build time)", async () => {
    const page = await import("./page");
    expect(page.dynamic).toBe("force-dynamic");
  });


  it("OPG-1: renders the dashboard heading on a successful load, both locales", async () => {
    mockLoad = async () => emptyView;
    for (const [locale, messages] of [["ro", ro], ["en", en]] as const) {
      const html = await renderPage(locale, messages);
      expect(html).toContain(messages.Admin.operations.heading);
    }
  });

  it("OPG-2: the loader throwing an error with connection details shows the translated error and leaks nothing", async () => {
    mockLoad = async () => {
      throw new Error("connection refused: postgres://user:secret@db.example.com/etfs");
    };
    for (const [locale, messages] of [["ro", ro], ["en", en]] as const) {
      const html = await renderPage(locale, messages);
      expect(html).toContain(messages.Admin.operations.loadError);
      expect(html).not.toContain("connection refused");
      expect(html).not.toContain("postgres://");
      expect(html).not.toContain("secret");
    }
  });

  it("OPG-3: MissingDatabaseUrlError shows the same error state and no DATABASE_URL text", async () => {
    mockLoad = async () => {
      const { MissingDatabaseUrlError } = await import("@/lib/db/index");
      throw new MissingDatabaseUrlError();
    };
    const html = await renderPage("en", en);
    expect(html).toContain(en.Admin.operations.loadError);
    expect(html).not.toContain("DATABASE_URL");
  });

  it("OPG-4: env secrets are never in the rendered HTML on a successful load", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://u:envsecret@h/db");
    vi.stubEnv("CRON_SECRET", "cronsecret123");
    mockLoad = async () => emptyView;
    const html = await renderPage("en", en);
    expect(html).not.toContain("envsecret");
    expect(html).not.toContain("cronsecret123");
  });

  it("OPG-5: rendering the page never calls fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    mockLoad = async () => emptyView;
    await renderPage("en", en);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
