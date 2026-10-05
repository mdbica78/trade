import { deltaDirection } from "@/lib/format/delta-direction";

const GLYPH = { gain: "▲", loss: "▼", flat: "–" } as const;
const TEXT_KEY = { gain: "arrowUp", loss: "arrowDown", flat: "arrowFlat" } as const;

/**
 * Shared accessible up/down/flat arrow (US-050 B7): an aria-hidden glyph plus a screen-reader-only
 * text key. Each caller passes its own namespaced translator, since `HomeTable` (`Home`) and
 * `CustomValues` (`EtfDetail.widgets`) use different message namespaces for the same three keys.
 */
export function DeltaArrow({
  canonical,
  t,
}: {
  canonical: string;
  t: (key: "arrowUp" | "arrowDown" | "arrowFlat") => string;
}) {
  const direction = deltaDirection(canonical);
  return (
    <>
      <span aria-hidden="true">{GLYPH[direction]}</span>
      <span className="sr-only">{t(TEXT_KEY[direction])}</span>
      {" "}
    </>
  );
}
