/** Pure nav-active logic for the header (DEC-020 §8). No React, no DOM. */

export function isNavActive(href: string, pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
