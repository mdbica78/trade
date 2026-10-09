import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Recursively list files under `dir` (relative to `root`) whose name matches one of `extensions`. */
export function walkFiles(root: string, dir: string, extensions: string[]): string[] {
  const abs = join(root, dir);
  let entries: string[];
  try {
    entries = readdirSync(abs);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    const relPath = join(dir, entry);
    const absPath = join(root, relPath);
    const stat = statSync(absPath);
    if (stat.isDirectory()) {
      out.push(...walkFiles(root, relPath, extensions));
    } else if (extensions.some((ext) => entry.endsWith(ext)) && !entry.includes(".test.")) {
      out.push(relPath);
    }
  }
  return out;
}
