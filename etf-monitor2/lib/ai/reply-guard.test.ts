import { describe, expect, it } from "vitest";
import { containsKeyMaterial } from "./reply-guard";

describe("containsKeyMaterial (RG)", () => {
  it("RG-1: flags text containing the exact active key", () => {
    expect(containsKeyMaterial("your key is SENTINEL-FAKE-KEY-0001", "SENTINEL-FAKE-KEY-0001")).toBe(true);
    expect(containsKeyMaterial("nothing suspicious here", "SENTINEL-FAKE-KEY-0001")).toBe(false);
  });

  it("RG-2: flags each known key-shaped pattern even without the active key", () => {
    expect(containsKeyMaterial("key: AIzaSyD-abcdefghijklmnopqrstuvwxyz0123", null)).toBe(true);
    expect(containsKeyMaterial("key: gsk_abcdefghijklmnopqrstuvwxyz0123", null)).toBe(true);
    expect(containsKeyMaterial("key: sk-abcdefghijklmnopqrstuvwxyz01234567", null)).toBe(true);
    expect(containsKeyMaterial("key: csk-abcdefghijklmnopqrstuvwxyz01234567", null)).toBe(true);
    expect(containsKeyMaterial("GEMINI_API_KEY=abc123", null)).toBe(true);
    expect(containsKeyMaterial("AI_KEY_MASTER_KEY: xyz", null)).toBe(true);
    expect(containsKeyMaterial("random token abcDEFabcdDEF1234567890123456789012", null)).toBe(true);
  });

  it("RG-3: a short string is never treated as the active key (length < 8)", () => {
    expect(containsKeyMaterial("the field is net_asset", "abc")).toBe(false);
  });

  it("RG-4: ordinary replies with field keys, symbols and numbers are not flagged", () => {
    expect(containsKeyMaterial("Adaug maximul unităților în circulație pentru BTBETRETF.", "sk-realkeyabcdefghijklmno12345678")).toBe(
      false,
    );
    expect(containsKeyMaterial("Tracked net_asset for XYZ, period 30 days.", null)).toBe(false);
    expect(containsKeyMaterial("The active ETFs are BTBETRETF and TVBETETF.", null)).toBe(false);
  });
});
