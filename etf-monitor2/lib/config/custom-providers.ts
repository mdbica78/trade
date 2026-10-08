import { sql } from "drizzle-orm";
import type { Db } from "../db/index";
import { rowsOf, type BatchRunner } from "../ingestion/store";
import { describeLoadError } from "../log/load-error";

export const CUSTOM_PROVIDER_MAX = 5;
export const CUSTOM_PROVIDER_NAME_MAX_LENGTH = 40;
export const CUSTOM_PROVIDER_URL_MAX_LENGTH = 200;

export type CustomProvider = { id: string; name: string; baseUrl: string };
export type CustomProviderReadDeps = { db: Db; run: BatchRunner };
export type CustomProviderConfigDeps = CustomProviderReadDeps & {
  clearKeyStatement: (providerId: string) => ReturnType<Db["execute"]>;
};
export type CustomProviderResult =
  | { ok: true; id: string; keyRemoved: boolean }
  | { ok: false; error: "invalid_name" | "invalid_url" | "limit_reached" | "not_found" };

const CUSTOM_ID_RE = /^custom-[1-9]\d{0,9}$/;
const PRIVATE_HOST_SUFFIXES = [
  "localhost",
  "local",
  "localdomain",
  "internal",
  "intranet",
  "lan",
  "home",
  "home.arpa",
  "corp",
  "private",
];
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

export function customProviderId(rowId: number): string {
  return `custom-${rowId}`;
}

export function isCustomProviderId(id: unknown): id is string {
  return typeof id === "string" && CUSTOM_ID_RE.test(id);
}

export function validateCustomProviderName(raw: unknown): { ok: true; name: string } | { ok: false } {
  if (typeof raw !== "string") return { ok: false };
  const trimmed = raw.trim();
  if (trimmed.length < 1 || trimmed.length > CUSTOM_PROVIDER_NAME_MAX_LENGTH) return { ok: false };
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return { ok: false };
  return { ok: true, name: trimmed };
}

function isPrivateHostname(hostname: string): boolean {
  return PRIVATE_HOST_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
}

function isIpLiteral(hostname: string): boolean {
  if (hostname.startsWith("[") && hostname.endsWith("]")) return true;
  if (IPV4_RE.test(hostname)) return true;
  return false;
}

export function validateCustomProviderBaseUrl(raw: unknown): { ok: true; url: string } | { ok: false } {
  if (typeof raw !== "string") return { ok: false };
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > CUSTOM_PROVIDER_URL_MAX_LENGTH) return { ok: false };
  if (/[\s\u0000-\u001f\u007f]/.test(trimmed)) return { ok: false };
  if (trimmed.includes("?") || trimmed.includes("#")) return { ok: false };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false };
  }
  if (url.protocol !== "https:") return { ok: false };
  if (url.username !== "" || url.password !== "") return { ok: false };
  const hostname = url.hostname.toLowerCase();
  if (hostname.endsWith(".")) return { ok: false };
  if (isIpLiteral(hostname)) return { ok: false };
  if (!hostname.includes(".")) return { ok: false };
  const lastLabel = hostname.slice(hostname.lastIndexOf(".") + 1);
  if (!/[a-z]/.test(lastLabel)) return { ok: false };
  if (isPrivateHostname(hostname)) return { ok: false };

  const normalised = `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}`;
  if (normalised.length > CUSTOM_PROVIDER_URL_MAX_LENGTH) return { ok: false };
  return { ok: true, url: normalised };
}

function isMissingCustomProviderTable(error: unknown): boolean {
  return describeLoadError(error).code === "42P01";
}

function rowToProvider(row: Record<string, unknown>): CustomProvider | null {
  const nameResult = validateCustomProviderName(row.name);
  const urlResult = validateCustomProviderBaseUrl(row.base_url);
  if (!nameResult.ok || !urlResult.ok || urlResult.url !== String(row.base_url)) return null;
  return { id: customProviderId(Number(row.id)), name: nameResult.name, baseUrl: urlResult.url };
}

export async function listCustomProviders(deps: CustomProviderReadDeps): Promise<readonly CustomProvider[]> {
  try {
    const [result] = await deps.run([
      deps.db.execute(sql`select "id", "name", "base_url" from "ai_custom_providers" order by "id"`),
    ]);
    return rowsOf(result)
      .map(rowToProvider)
      .filter((provider): provider is CustomProvider => provider !== null);
  } catch (error) {
    if (isMissingCustomProviderTable(error)) return [];
    throw error;
  }
}

function parseRowId(id: unknown): number | null {
  if (!isCustomProviderId(id)) return null;
  return Number(id.slice("custom-".length));
}

export async function addCustomProvider(
  input: { name: unknown; baseUrl: unknown },
  deps: CustomProviderReadDeps,
): Promise<CustomProviderResult> {
  const nameResult = validateCustomProviderName(input.name);
  if (!nameResult.ok) return { ok: false, error: "invalid_name" };
  const urlResult = validateCustomProviderBaseUrl(input.baseUrl);
  if (!urlResult.ok) return { ok: false, error: "invalid_url" };

  const [result] = await deps.run([
    deps.db.execute(
      sql`insert into "ai_custom_providers" ("name", "base_url")
          select ${nameResult.name}::text, ${urlResult.url}::text
          where (select count(*) from "ai_custom_providers") < ${CUSTOM_PROVIDER_MAX}::int
          returning "id"`,
    ),
  ]);
  const row = rowsOf(result)[0];
  if (!row) return { ok: false, error: "limit_reached" };
  return { ok: true, id: customProviderId(Number(row.id)), keyRemoved: false };
}

export async function updateCustomProvider(
  input: { id: unknown; name: unknown; baseUrl: unknown },
  deps: CustomProviderConfigDeps,
): Promise<CustomProviderResult> {
  const rowId = parseRowId(input.id);
  if (rowId === null) return { ok: false, error: "not_found" };
  const nameResult = validateCustomProviderName(input.name);
  if (!nameResult.ok) return { ok: false, error: "invalid_name" };
  const urlResult = validateCustomProviderBaseUrl(input.baseUrl);
  if (!urlResult.ok) return { ok: false, error: "invalid_url" };

  const [currentResult] = await deps.run([
    deps.db.execute(sql`select "base_url" from "ai_custom_providers" where "id" = ${rowId}`),
  ]);
  const currentRow = rowsOf(currentResult)[0];
  if (!currentRow) return { ok: false, error: "not_found" };
  const urlChanged = String(currentRow.base_url) !== urlResult.url;
  const id = customProviderId(rowId);

  const update = deps.db.execute(
    sql`update "ai_custom_providers" set "name" = ${nameResult.name}, "base_url" = ${urlResult.url}
        where "id" = ${rowId} returning "id"`,
  );
  const results = await deps.run(urlChanged ? [deps.clearKeyStatement(id), update] : [update]);
  const updateResult = results[results.length - 1];
  if (!rowsOf(updateResult)[0]) return { ok: false, error: "not_found" };
  return { ok: true, id, keyRemoved: urlChanged };
}

export async function deleteCustomProvider(
  id: unknown,
  deps: CustomProviderConfigDeps,
): Promise<CustomProviderResult> {
  const rowId = parseRowId(id);
  if (rowId === null) return { ok: false, error: "not_found" };
  const providerId = customProviderId(rowId);

  const [, deleteResult] = await deps.run([
    deps.clearKeyStatement(providerId),
    deps.db.execute(sql`delete from "ai_custom_providers" where "id" = ${rowId} returning "id"`),
  ]);
  if (!rowsOf(deleteResult)[0]) return { ok: false, error: "not_found" };
  return { ok: true, id: providerId, keyRemoved: true };
}
