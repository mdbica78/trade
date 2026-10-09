import { describe, expect, it } from "vitest";
import vm from "node:vm";
import {
  DEFAULT_THEME,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  isTheme,
  nextTheme,
  readStoredTheme,
  readSystemPreference,
  resolveTheme,
  toggleTheme,
  writeStoredTheme,
  type StorageLike,
  type Theme,
} from "./theme";

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

function throwingStorage(): StorageLike {
  return {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
}

describe("TH-1/TH-2/TH-3: resolveTheme", () => {
  it("TH-1 a valid stored value wins over any preference", () => {
    expect(resolveTheme("light", "dark")).toBe("light");
    expect(resolveTheme("dark", "light")).toBe("dark");
  });

  it("TH-2 no stored value follows the preference, and defaults to dark with neither", () => {
    expect(resolveTheme(null, "light")).toBe("light");
    expect(resolveTheme(null, "dark")).toBe("dark");
    expect(resolveTheme(null, null)).toBe(DEFAULT_THEME);
    expect(DEFAULT_THEME).toBe("dark");
  });

  it("TH-3 an invalid stored value is ignored", () => {
    expect(resolveTheme("blue", "light")).toBe("light");
    expect(resolveTheme("", "dark")).toBe("dark");
    expect(resolveTheme("DARK", null)).toBe(DEFAULT_THEME);
  });
});

describe("TH-4: storage read/write never throws", () => {
  it("a getStorage() that throws yields null and no throw", () => {
    expect(() => readStoredTheme(() => { throw new Error("no storage"); })).not.toThrow();
    expect(readStoredTheme(() => { throw new Error("no storage"); })).toBeNull();
  });

  it("a storage whose methods all throw yields null and no throw", () => {
    const storage = throwingStorage();
    expect(readStoredTheme(() => storage)).toBeNull();
    expect(() => writeStoredTheme(() => storage, "dark")).not.toThrow();
  });

  it("a working storage round-trips a stored theme", () => {
    const storage = fakeStorage();
    writeStoredTheme(() => storage, "light");
    expect(readStoredTheme(() => storage)).toBe("light");
  });
});

describe("TH-5: readSystemPreference", () => {
  it("returns null with no matchMedia", () => {
    expect(readSystemPreference()).toBeNull();
  });

  it("returns null when matchMedia throws", () => {
    expect(
      readSystemPreference(() => {
        throw new Error("no matchMedia");
      }),
    ).toBeNull();
  });

  it("returns dark or light from the fake matches", () => {
    expect(readSystemPreference((q) => ({ matches: q.includes("dark") }))).toBe("dark");
    expect(readSystemPreference((q) => ({ matches: q.includes("light") }))).toBe("light");
    expect(readSystemPreference(() => ({ matches: false }))).toBeNull();
  });
});

describe("TH-6: toggleTheme", () => {
  function fakeRoot(initial: string | null) {
    let attr: string | null = initial;
    return {
      getAttribute: (name: string) => (name === "data-theme" ? attr : null),
      setAttribute: (name: string, value: string) => {
        if (name === "data-theme") attr = value;
      },
      get current() {
        return attr;
      },
    };
  }

  it("from dark it sets light", () => {
    const root = fakeRoot("dark");
    const storage = fakeStorage();
    const result = toggleTheme({ root, getStorage: () => storage });
    expect(result).toBe("light");
    expect(root.current).toBe("light");
    expect(storage.data[THEME_STORAGE_KEY]).toBe("light");
  });

  it("from light, missing or invalid attribute it sets dark", () => {
    for (const initial of ["light", null, "blue"]) {
      const root = fakeRoot(initial);
      const storage = fakeStorage();
      const result = toggleTheme({ root, getStorage: () => storage });
      expect(result).toBe("dark");
      expect(root.current).toBe("dark");
    }
  });

  it("with a throwing storage it still flips the attribute and does not throw", () => {
    const root = fakeRoot("dark");
    expect(() => toggleTheme({ root, getStorage: throwingStorage })).not.toThrow();
    expect(root.current).toBe("light");
  });
});

describe("TH-7: THEME_INIT_SCRIPT is built from the module's constants", () => {
  it("contains the literal storage key and uses DEFAULT_THEME", () => {
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(DEFAULT_THEME));
  });
});

describe("TH-8: the inline script agrees with resolveTheme for every case", () => {
  function runScript(opts: {
    stored?: string | null;
    storageThrows?: boolean;
    preference?: "dark" | "light" | null;
    matchMediaMissing?: boolean;
    matchMediaThrows?: boolean;
  }): { theme: string | null; threw: boolean } {
    let setAttr: string | null = null;
    const localStorage = opts.storageThrows
      ? {
          getItem: () => {
            throw new Error("blocked");
          },
        }
      : { getItem: () => (opts.stored === undefined ? null : opts.stored) };

    const matchMedia = opts.matchMediaMissing
      ? undefined
      : opts.matchMediaThrows
        ? () => {
            throw new Error("no matchMedia");
          }
        : (query: string) => ({
            matches:
              (opts.preference === "dark" && query.includes("dark")) ||
              (opts.preference === "light" && query.includes("light")),
          });

    const sandbox: Record<string, unknown> = {
      window: { localStorage, matchMedia },
      document: {
        documentElement: {
          setAttribute: (name: string, value: string) => {
            if (name === "data-theme") setAttr = value;
          },
        },
      },
    };
    let threw = false;
    try {
      vm.createContext(sandbox);
      vm.runInContext(THEME_INIT_SCRIPT, sandbox);
    } catch {
      threw = true;
    }
    return { theme: setAttr, threw };
  }

  const storedCases: (string | null | undefined)[] = ["light", "dark", "blue", null, undefined];
  const preferenceCases: ("dark" | "light" | null)[] = ["dark", "light", null];
  const storageCases = [false, true];
  const matchMediaCases: { missing: boolean; throws: boolean }[] = [
    { missing: false, throws: false },
    { missing: true, throws: false },
    { missing: false, throws: true },
  ];

  it("matches resolveTheme for the full matrix, and never throws", () => {
    for (const stored of storedCases) {
      for (const preference of preferenceCases) {
        for (const storageThrows of storageCases) {
          for (const mm of matchMediaCases) {
            const { theme, threw } = runScript({
              stored,
              storageThrows,
              preference,
              matchMediaMissing: mm.missing,
              matchMediaThrows: mm.throws,
            });
            expect(threw).toBe(false);

            const effectiveStored = storageThrows ? null : (stored ?? null);
            const effectivePreference = mm.missing || mm.throws ? null : preference;
            const expected: Theme = resolveTheme(effectiveStored, effectivePreference);
            expect(theme).toBe(expected);
          }
        }
      }
    }
  });
});

describe("isTheme / nextTheme", () => {
  it("isTheme accepts only light/dark", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("blue")).toBe(false);
    expect(isTheme(null)).toBe(false);
  });

  it("nextTheme flips dark to light and everything else to dark", () => {
    expect(nextTheme("dark")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme(null)).toBe("dark");
    expect(nextTheme("blue")).toBe("dark");
  });
});
