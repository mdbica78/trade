import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import ro from "../messages/ro.json";

let cookieValue: string | undefined;

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "NEXT_LOCALE" && cookieValue !== undefined ? { value: cookieValue } : undefined,
  })),
}));

vi.mock("next-intl/server", () => ({
  getRequestConfig: (fn: () => unknown) => fn,
}));

describe("i18n request config", () => {
  beforeEach(() => {
    vi.resetModules();
    cookieValue = undefined;
  });

  it("defaults to ro when there is no cookie", async () => {
    const getConfig = (await import("./request")).default as () => Promise<{
      locale: string;
      messages: unknown;
      timeZone: string;
    }>;
    const result = await getConfig();
    expect(result.locale).toBe("ro");
    expect(result.messages).toEqual(ro);
    expect(result.timeZone).toBe("Europe/Bucharest");
  });

  it("uses en when the cookie says en", async () => {
    cookieValue = "en";
    const getConfig = (await import("./request")).default as () => Promise<{
      locale: string;
      messages: unknown;
    }>;
    const result = await getConfig();
    expect(result.locale).toBe("en");
    expect(result.messages).toEqual(en);
  });

  it.each(["fr", "", "EN"])("falls back to ro for an invalid cookie value %s", async (value) => {
    cookieValue = value;
    const getConfig = (await import("./request")).default as () => Promise<{
      locale: string;
      messages: unknown;
    }>;
    const result = await getConfig();
    expect(result.locale).toBe("ro");
    expect(result.messages).toEqual(ro);
  });
});
