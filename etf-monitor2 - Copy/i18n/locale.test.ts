import { describe, expect, it } from "vitest";
import { defaultLocale, isLocale, locales, resolveLocale } from "./locale";

describe("locale", () => {
  it("defines ro and en, defaulting to ro", () => {
    expect(locales).toEqual(["ro", "en"]);
    expect(defaultLocale).toBe("ro");
  });

  it("isLocale narrows valid locale strings only", () => {
    expect(isLocale("ro")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale("EN")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("resolveLocale falls back to the default for anything invalid", () => {
    expect(resolveLocale(undefined)).toBe("ro");
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("de")).toBe("ro");
    expect(resolveLocale("")).toBe("ro");
    expect(resolveLocale("EN")).toBe("ro");
  });
});
