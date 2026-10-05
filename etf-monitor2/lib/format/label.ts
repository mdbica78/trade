/** No imports, client-safe: every RO/EN catalogue-labelled item picks its label the same way (US-050 B8). */
export function localizedLabel(item: { labelRo: string; labelEn: string }, locale: string): string {
  return locale === "ro" ? item.labelRo : item.labelEn;
}
