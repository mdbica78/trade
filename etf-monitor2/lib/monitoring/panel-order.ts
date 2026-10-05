/**
 * No imports: this must never pull `home.ts` (drizzle/neon/adapter registry) into the client
 * Customize-panel bundle (US-050 B1). Positioned columns sort by `position`; unpositioned ones
 * come after, sorted by `catalogueOrder`.
 */
export type PanelOrderKey = { position: number | null; catalogueOrder: number };

export function comparePanelColumns(a: PanelOrderKey, b: PanelOrderKey): number {
  if (a.position !== null || b.position !== null) {
    if (a.position === null) return 1;
    if (b.position === null) return -1;
    if (a.position !== b.position) return a.position - b.position;
  }
  return a.catalogueOrder - b.catalogueOrder;
}
