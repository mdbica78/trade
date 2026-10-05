import { describe, expect, it } from "vitest";
import { localizedLabel } from "./label";

describe("LL-1 (US-050 B8): localizedLabel", () => {
  it("picks labelRo for ro and labelEn for anything else", () => {
    const item = { labelRo: "R", labelEn: "E" };
    expect(localizedLabel(item, "ro")).toBe("R");
    expect(localizedLabel(item, "en")).toBe("E");
  });
});
