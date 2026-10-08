import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";

let mockGetDb: () => unknown = () => ({});
let mockCreateAiSettingsDeps: () => unknown = () => ({});
let mockGetAiSettings: () => Promise<{ provider: string | null; model: string | null }> = async () => ({
  provider: "gemini",
  model: "m-1",
});

vi.mock("@/lib/db", () => ({ getDb: () => mockGetDb() }));
vi.mock("@/lib/ai/settings-deps", () => ({ createAiSettingsDeps: () => mockCreateAiSettingsDeps() }));
vi.mock("@/lib/config/ai-settings", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/config/ai-settings")>();
  return { ...original, getAiSettings: () => mockGetAiSettings() };
});
vi.mock("./actions", () => ({ sendChatMessageAction: vi.fn(), confirmChatPlanAction: vi.fn() }));

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "ZQ-KEY-GEM-SAFETY");
  vi.stubEnv("GROQ_API_KEY", "ZQ-KEY-GRQ-SAFETY");
});

afterEach(() => {
  vi.unstubAllEnvs();
  mockGetDb = () => ({});
  mockCreateAiSettingsDeps = () => ({});
  mockGetAiSettings = async () => ({ provider: "gemini", model: "m-1" });
});

async function renderPage() {
  const { default: Page } = await import("./page");
  const element = await Page();
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      {element}
    </NextIntlClientProvider>,
  );
}

describe("Chat page never leaks a key or an exception (AC7, CPS)", () => {
  it("CPS-1: ok state renders the composer, no key in the HTML", async () => {
    const html = await renderPage();
    expect(html).toContain("<textarea");
    expect(html).not.toContain("ZQ-KEY");
  });

  it("CPS-2: getDb() throwing shows Chat.loadError, no composer, no secret text", async () => {
    mockGetDb = () => {
      throw new Error("ZQ-EXC-postgres postgres://user:pw@host");
    };
    const html = await renderPage();
    expect(html).toContain(en.Chat.loadError);
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("ZQ-EXC");
    expect(html).not.toContain("postgres://");
    expect(html).not.toContain("ZQ-KEY");
  });

  it("CPS-3a: createAiSettingsDeps() throwing shows Chat.loadError, no composer", async () => {
    mockCreateAiSettingsDeps = () => {
      throw new Error("ZQ-EXC-deps");
    };
    const html = await renderPage();
    expect(html).toContain(en.Chat.loadError);
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("ZQ-EXC");
  });

  it("CPS-3b: getAiSettings rejecting shows Chat.loadError, no composer", async () => {
    mockGetAiSettings = () => Promise.reject(new Error("ZQ-EXC-reject postgres://x"));
    const html = await renderPage();
    expect(html).toContain(en.Chat.loadError);
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("ZQ-EXC");
    expect(html).not.toContain("postgres://");
  });

  it("CPG-6: no fetch call while rendering the page in any state", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error("real network forbidden");
    });
    vi.stubGlobal("fetch", fetchSpy);
    await renderPage();
    mockGetDb = () => {
      throw new Error("boom");
    };
    await renderPage();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
