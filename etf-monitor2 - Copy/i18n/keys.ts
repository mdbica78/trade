type MessageTree = { [key: string]: string | MessageTree };

export function collectKeyPaths(obj: MessageTree, prefix = ""): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      paths.push(path);
    } else {
      paths.push(...collectKeyPaths(value, path));
    }
  }
  return paths.sort();
}

export function findKeyMismatches(
  a: MessageTree,
  b: MessageTree,
): { onlyInA: string[]; onlyInB: string[] } {
  const keysA = new Set(collectKeyPaths(a));
  const keysB = new Set(collectKeyPaths(b));
  return {
    onlyInA: [...keysA].filter((k) => !keysB.has(k)).sort(),
    onlyInB: [...keysB].filter((k) => !keysA.has(k)).sort(),
  };
}

export function assertSameKeys(a: MessageTree, b: MessageTree): void {
  const { onlyInA, onlyInB } = findKeyMismatches(a, b);
  if (onlyInA.length > 0 || onlyInB.length > 0) {
    throw new Error(
      `Message catalogues have mismatched keys. Only in first: [${onlyInA.join(", ")}]. ` +
        `Only in second: [${onlyInB.join(", ")}].`,
    );
  }
}
