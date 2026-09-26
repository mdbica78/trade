/** Extracts every static/side-effect import, multi-line import, dynamic import() and require() specifier. */
export function extractModuleSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const importRe = /import\s+(?:type\s+)?(?:[\s\S]*?from\s+)?["']([^"']+)["']/g;
  const dynamicImportRe = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  const requireRe = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const re of [importRe, dynamicImportRe, requireRe]) {
    let match: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((match = re.exec(source)) !== null) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}
