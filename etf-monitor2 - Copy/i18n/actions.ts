"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "./locale";

const ONE_YEAR_SECONDS = 31536000;

export async function setLocale(formData: FormData): Promise<void> {
  const value = formData.get("locale");
  if (!isLocale(value)) {
    return;
  }
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, value, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
  });
}
