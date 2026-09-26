import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyTestDatabase, type EmptyTestDatabase } from "../../test/helpers/pglite";
import { getAiSettings, setAiSettings, type AiSettingsDeps } from "./ai-settings";

let db: EmptyTestDatabase;

beforeEach(async () => {
  db = await createEmptyTestDatabase();
}, 30_000);

afterEach(async () => {
  await db.close();
  vi.unstubAllEnvs();
});

function deps(overrides: Partial<AiSettingsDeps> = {}): AiSettingsDeps {
  return { db: db.mockDb, run: db.runner, providerIds: ["gemini", "groq", "openrouter", "mistral"], ...overrides };
}

describe("setAiSettings / getAiSettings on PGlite (AS)", () => {
  it("AS-2: saves provider and model, trims the model, leaves the other settings columns untouched", async () => {
    await db.pg.query(
      'insert into "settings" ("id", "ai_provider", "ai_model", "cron_hour_utc", "default_locale") values (1, null, null, 7, $1)',
      ["en"],
    );
    const result = await setAiSettings({ provider: "groq", model: "  llama-3.3-70b-versatile " }, deps());
    expect(result).toEqual({ ok: true, provider: "groq", model: "llama-3.3-70b-versatile" });

    const row = await db.pg.query<{
      ai_provider: string | null;
      ai_model: string | null;
      cron_hour_utc: number | null;
      default_locale: string;
    }>('select "ai_provider", "ai_model", "cron_hour_utc", "default_locale" from "settings" where "id" = 1');
    expect(row.rows).toEqual([{ ai_provider: "groq", ai_model: "llama-3.3-70b-versatile", cron_hour_utc: 7, default_locale: "en" }]);
    const all = await db.pg.query('select * from "settings"');
    expect(all.rows).toHaveLength(1);
  });

  it("AS-3: with no existing row, save creates id=1 with the column defaults", async () => {
    await setAiSettings({ provider: "gemini", model: null }, deps());
    const row = await db.pg.query<{ cron_hour_utc: number | null; default_locale: string }>(
      'select "cron_hour_utc", "default_locale" from "settings" where "id" = 1',
    );
    expect(row.rows).toEqual([{ cron_hour_utc: null, default_locale: "ro" }]);
  });

  it("AS-4: clearing the provider (empty string) nulls both columns, keeps cron_hour_utc/default_locale", async () => {
    await db.pg.query(
      'insert into "settings" ("id", "ai_provider", "ai_model", "cron_hour_utc", "default_locale") values (1, $1, $2, 7, $3)',
      ["groq", "llama-3.3-70b-versatile", "en"],
    );
    const result = await setAiSettings({ provider: "", model: "kept?" }, deps());
    expect(result).toEqual({ ok: true, provider: null, model: null });
    const row = await db.pg.query<{
      ai_provider: string | null;
      ai_model: string | null;
      cron_hour_utc: number | null;
      default_locale: string;
    }>('select "ai_provider", "ai_model", "cron_hour_utc", "default_locale" from "settings" where "id" = 1');
    expect(row.rows).toEqual([{ ai_provider: null, ai_model: null, cron_hour_utc: 7, default_locale: "en" }]);
  });

  it("AS-4b: null and undefined provider behave like an empty string", async () => {
    await db.pg.query('insert into "settings" ("id", "ai_provider", "ai_model") values (1, $1, $2)', ["groq", "m"]);
    expect(await setAiSettings({ provider: null, model: "kept?" }, deps())).toEqual({
      ok: true,
      provider: null,
      model: null,
    });
    expect(await setAiSettings({ provider: undefined, model: "kept?" }, deps())).toEqual({
      ok: true,
      provider: null,
      model: null,
    });
  });

  it("AS-5: a blank model is stored as NULL", async () => {
    const result = await setAiSettings({ provider: "groq", model: "   " }, deps());
    expect(result).toEqual({ ok: true, provider: "groq", model: null });
  });

  it("AS-6: a model of exactly 200 characters is accepted and stored as is", async () => {
    const model = "m".repeat(200);
    const result = await setAiSettings({ provider: "groq", model }, deps());
    expect(result).toEqual({ ok: true, provider: "groq", model });
  });

  it("AS-7: an invalid save leaves the row unchanged", async () => {
    await db.pg.query('insert into "settings" ("id", "ai_provider", "ai_model") values (1, $1, $2)', ["groq", "m"]);
    const before = await db.pg.query('select * from "settings"');
    await expect(setAiSettings({ provider: "openai", model: null }, deps())).resolves.toEqual({
      ok: false,
      error: "unknown_provider",
    });
    await expect(setAiSettings({ provider: "groq", model: "x".repeat(201) }, deps())).resolves.toEqual({
      ok: false,
      error: "invalid_model",
    });
    const after = await db.pg.query('select * from "settings"');
    expect(after.rows).toEqual(before.rows);
  });

  it("AS-8: getAiSettings returns what was saved, and {null,null} with no row", async () => {
    expect(await getAiSettings(deps())).toEqual({ provider: null, model: null });
    await setAiSettings({ provider: "mistral", model: "mistral-small" }, deps());
    expect(await getAiSettings(deps())).toEqual({ provider: "mistral", model: "mistral-small" });
  });

  it("AS-9: no network call during a save", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await setAiSettings({ provider: "groq", model: "m" }, deps());
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("AS-10: a database dump after saving with keys set in the environment contains no key value", async () => {
    vi.stubEnv("GEMINI_API_KEY", "SENTINEL-gemini-9f3c");
    vi.stubEnv("GROQ_API_KEY", "SENTINEL-groq-9f3c");
    vi.stubEnv("OPENROUTER_API_KEY", "SENTINEL-openrouter-9f3c");
    vi.stubEnv("MISTRAL_API_KEY", "SENTINEL-mistral-9f3c");
    await setAiSettings({ provider: "groq", model: "m" }, deps());
    const dump = await db.pg.query<{ dump: string }>('select row_to_json(s)::text as dump from "settings" s');
    expect(dump.rows[0].dump).not.toContain("SENTINEL");
  });

  it("AS-11: a successful save is exactly one runner call holding one statement", async () => {
    const spy = vi.fn(db.runner);
    const result = await setAiSettings({ provider: "groq", model: "m" }, deps({ run: spy as unknown as AiSettingsDeps["run"] }));
    expect(result.ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toHaveLength(1);
  });
});
