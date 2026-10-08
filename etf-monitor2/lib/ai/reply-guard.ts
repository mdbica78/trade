const KEY_LIKE_PATTERNS: readonly RegExp[] = [
  /\bAIza[0-9A-Za-z_-]{30,}/,
  /\bgsk_[0-9A-Za-z]{20,}/,
  /\bc?sk-[0-9A-Za-z_-]{20,}/,
  /\b[A-Z][A-Z0-9_]*_(?:API_KEY|SECRET|MASTER_KEY)\s*[=:]/,
  /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}\b/,
];

/** True if `text` contains the active call's key, or looks like a key of a known shape. Never logs. */
export function containsKeyMaterial(text: string, apiKey: string | null): boolean {
  if (apiKey !== null && apiKey.length >= 8 && text.includes(apiKey)) return true;
  return KEY_LIKE_PATTERNS.some((pattern) => pattern.test(text));
}
