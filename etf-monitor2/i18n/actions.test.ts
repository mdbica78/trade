import { beforeEach, describe, expect, it, vi } from "vitest";

const setMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: setMock })),
}));

describe("setLocale", () => {
  beforeEach(() => {
    setMock.mockClear();
  });

  it("sets the NEXT_LOCALE cookie for a valid locale", async () => {
    const { setLocale } = await import("./actions");
    const formData = new FormData();
    formData.set("locale", "en");
    await setLocale(formData);
    expect(setMock).toHaveBeenCalledWith("NEXT_LOCALE", "en", {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
    });
  });

  it.each([["fr"], [""]])("does not set a cookie for an invalid locale %s", async (value) => {
    const { setLocale } = await import("./actions");
    const formData = new FormData();
    formData.set("locale", value);
    await expect(setLocale(formData)).resolves.toBeUndefined();
    expect(setMock).not.toHaveBeenCalled();
  });

  it("does not set a cookie and does not throw when the field is missing", async () => {
    const { setLocale } = await import("./actions");
    const formData = new FormData();
    await expect(setLocale(formData)).resolves.toBeUndefined();
    expect(setMock).not.toHaveBeenCalled();
  });

  it("does not set a cookie for a non-string value", async () => {
    const { setLocale } = await import("./actions");
    const formData = new FormData();
    formData.set("locale", new Blob(["ro"]));
    await expect(setLocale(formData)).resolves.toBeUndefined();
    expect(setMock).not.toHaveBeenCalled();
  });
});
