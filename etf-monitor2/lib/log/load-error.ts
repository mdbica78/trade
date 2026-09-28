export type LoadErrorDescription = {
  name: string;
  code?: string;
  relation?: string;
};

const NAME_RE = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;
const CODE_RE = /^[0-9A-Z]{5}$/;
const RELATION_RE = /^[a-z_][a-z0-9_]*$/;
const RELATION_IN_MESSAGE_RE = /relation "([^"]*)" does not exist/;
const SCOPE_RE = /^[a-z0-9][a-z0-9/_-]*$/;

function safeName(value: unknown): string | undefined {
  return typeof value === "string" && NAME_RE.test(value) ? value : undefined;
}

function safeCode(value: unknown): string | undefined {
  return typeof value === "string" && CODE_RE.test(value) ? value : undefined;
}

function safeRelation(value: unknown): string | undefined {
  return typeof value === "string" && RELATION_RE.test(value) ? value : undefined;
}

function relationFromMessage(message: unknown): string | undefined {
  if (typeof message !== "string") return undefined;
  const match = RELATION_IN_MESSAGE_RE.exec(message);
  if (!match) return undefined;
  return safeRelation(match[1]);
}

export function describeLoadError(error: unknown): LoadErrorDescription {
  let name: string | undefined;
  let code: string | undefined;
  let relation: string | undefined;

  const seen = new Set<unknown>();
  let level: unknown = error;
  for (let depth = 0; depth < 4; depth++) {
    if (level === null || typeof level !== "object") break;
    if (seen.has(level)) break;
    seen.add(level);

    const record = level as Record<string, unknown>;

    if (depth === 0 && name === undefined) {
      name = safeName(record.name);
    }
    if (code === undefined) {
      code = safeCode(record.code);
    }
    if (relation === undefined) {
      relation = safeRelation(record.table) ?? relationFromMessage(record.message);
    }

    level = record.cause;
  }

  const result: LoadErrorDescription = { name: name ?? "Unknown" };
  if (code !== undefined) result.code = code;
  if (relation !== undefined) result.relation = relation;
  return result;
}

export function logLoadError(scope: string, error: unknown): void {
  const safeScope = typeof scope === "string" && SCOPE_RE.test(scope) ? scope : "unknown";
  let name = "Unknown";
  let code: string | undefined;
  let relation: string | undefined;
  try {
    const described = describeLoadError(error);
    name = described.name;
    code = described.code;
    relation = described.relation;
  } catch {
    // Fall back to the defaults above; the line below still prints with the known scope.
  }

  let line = `[load-error] ${safeScope} name=${name}`;
  if (code !== undefined) line += ` code=${code}`;
  if (relation !== undefined) line += ` relation=${relation}`;
  console.error(line);
}
