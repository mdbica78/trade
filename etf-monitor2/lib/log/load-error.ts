export type LoadErrorDescription = { name: string; code?: string; relation?: string };

const NAME_RE = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;
const CODE_RE = /^[0-9A-Z]{5}$/;
const RELATION_RE = /^[a-z_][a-z0-9_]*$/;
const RELATION_MESSAGE_RE = /relation "([^"]*)" does not exist/;
const SCOPE_RE = /^[a-z0-9][a-z0-9/_-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractName(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const name = value.name;
  return typeof name === "string" && NAME_RE.test(name) ? name : undefined;
}

function extractCode(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const code = value.code;
  return typeof code === "string" && CODE_RE.test(code) ? code : undefined;
}

function extractRelation(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const table = value.table;
  if (typeof table === "string" && RELATION_RE.test(table)) return table;
  const message = value.message;
  if (typeof message === "string") {
    const match = RELATION_MESSAGE_RE.exec(message);
    if (match && RELATION_RE.test(match[1])) return match[1];
  }
  return undefined;
}

export function describeLoadError(error: unknown): LoadErrorDescription {
  try {
    const levels: unknown[] = [];
    let current: unknown = error;
    const seen = new Set<unknown>();
    for (let i = 0; i < 4 && isRecord(current) && !seen.has(current); i++) {
      levels.push(current);
      seen.add(current);
      current = current.cause;
    }

    const name = extractName(levels[0]) ?? "Unknown";
    let code: string | undefined;
    let relation: string | undefined;
    for (const level of levels) {
      if (code === undefined) code = extractCode(level);
      if (relation === undefined) relation = extractRelation(level);
      if (code !== undefined && relation !== undefined) break;
    }

    const result: LoadErrorDescription = { name };
    if (code !== undefined) result.code = code;
    if (relation !== undefined) result.relation = relation;
    return result;
  } catch {
    return { name: "Unknown" };
  }
}

export function logLoadError(scope: string, error: unknown): void {
  try {
    const safeScope = SCOPE_RE.test(scope) ? scope : "unknown";
    const { name, code, relation } = describeLoadError(error);
    let line = `[load-error] ${safeScope} name=${name}`;
    if (code !== undefined) line += ` code=${code}`;
    if (relation !== undefined) line += ` relation=${relation}`;
    console.error(line);
  } catch {
    try {
      console.error(`[load-error] ${SCOPE_RE.test(scope) ? scope : "unknown"} name=Unknown`);
    } catch {
      // never throw
    }
  }
}
