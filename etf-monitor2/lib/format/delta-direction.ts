export function deltaDirection(canonical: string): "gain" | "loss" | "flat" {
  if (/^0+(?:\.0+)?$/.test(canonical.replace(/^-/, ""))) return "flat";
  return canonical.startsWith("-") ? "loss" : "gain";
}

export function deltaTone(canonical: string): "delta-gain" | "delta-loss" | "delta-flat" {
  return `delta-${deltaDirection(canonical)}`;
}

export function deltaArrow(canonical: string): { glyph: string; textKey: "arrowUp" | "arrowDown" | "arrowFlat" } {
  switch (deltaDirection(canonical)) {
    case "gain": return { glyph: "▲", textKey: "arrowUp" };
    case "loss": return { glyph: "▼", textKey: "arrowDown" };
    case "flat": return { glyph: "–", textKey: "arrowFlat" };
  }
}
