import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { BVB_REQUEST_HEADERS } from "./discovery";
import { PDF_REQUEST_HEADERS, downloadReportPdf, extractPdfText } from "./pdf";

const FIXTURES_DIR = path.join(__dirname, "../../test/fixtures");

// Buffer's .buffer can be typed ArrayBufferLike (SharedArrayBuffer included), which BlobPart
// rejects; allocate a fresh ArrayBuffer-backed Uint8Array and copy into it instead.
function readPdfFixture(name: string): Uint8Array<ArrayBuffer> {
  const buf = readFileSync(path.join(FIXTURES_DIR, name));
  const out = new Uint8Array(buf.byteLength);
  out.set(buf);
  return out;
}

/** Deterministic pseudo-random bytes (fixed-seed LCG), not Math.random. */
function pseudoRandomBytes(length: number, seed = 42): Uint8Array {
  let state = seed >>> 0;
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    state = (state * 1103515245 + 12345) >>> 0;
    out[i] = (state >>> 16) & 0xff;
  }
  return out;
}

describe("dependencies (AC1)", () => {
  it("has unpdf as a runtime dependency and not pdfjs-dist or pdf-parse", () => {
    const pkg = JSON.parse(readFileSync(path.join(__dirname, "../../package.json"), "utf8"));
    expect(typeof pkg.dependencies.unpdf).toBe("string");
    expect(pkg.dependencies.unpdf.length).toBeGreaterThan(0);
    for (const name of ["pdfjs-dist", "pdf-parse"]) {
      expect(pkg.dependencies).not.toHaveProperty(name);
      expect(pkg.devDependencies ?? {}).not.toHaveProperty(name);
    }
  });
});

describe("extractPdfText on fixtures (AC2)", () => {
  const cases = [
    "BTBETRETF-2026-09-21.pdf",
    "TVBETETF-2026-09-21.pdf",
    "PTENGETF-2026-09-21.pdf",
  ];
  const labels = [
    "ACTIV NET (in valuta fond - RON)",
    "NUMAR U.F. in circulatie, din care detinute de:",
    "VALOARE UNITARA A ACTIVULUI NET (VUAN) (RON)",
    "Numar investitori, din care:",
    "Raport depozitar la data de",
  ];

  for (const fixture of cases) {
    describe(fixture, () => {
      it("extracts ok: true", async () => {
        const result = await extractPdfText(readPdfFixture(fixture));
        expect(result.ok).toBe(true);
      });

      for (const label of labels) {
        it(`contains label "${label}"`, async () => {
          const result = await extractPdfText(readPdfFixture(fixture));
          expect(result.ok).toBe(true);
          if (result.ok) {
            expect(result.text).toContain(label);
          }
        });
      }

      it("has no line breaks (flattened output, US-010's contract)", async () => {
        const result = await extractPdfText(readPdfFixture(fixture));
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.text).not.toContain("\n");
        }
      });
    });
  }
});

describe("extractPdfText on unreadable input (AC3)", () => {
  it("gives unreadable for pseudo-random bytes whose first byte is not %", async () => {
    const bytes = pseudoRandomBytes(4096);
    expect(bytes[0]).not.toBe(0x25);
    const result = await extractPdfText(bytes);
    expect(result).toMatchObject({ ok: false, kind: "unreadable" });
    if (!result.ok) expect(result.message.length).toBeGreaterThan(0);
  });

  it("gives unreadable for a real fixture truncated to 1024 bytes", async () => {
    const full = readPdfFixture("BTBETRETF-2026-09-21.pdf");
    const truncated = full.slice(0, 1024);
    const result = await extractPdfText(truncated);
    expect(result).toMatchObject({ ok: false, kind: "unreadable" });
    if (!result.ok) expect(result.message.length).toBeGreaterThan(0);
  });

  it("gives unreadable for a valid signature followed by garbage", async () => {
    const header = new TextEncoder().encode("%PDF-1.4\n");
    const garbage = pseudoRandomBytes(2048, 7);
    const bytes = new Uint8Array(header.length + garbage.length);
    bytes.set(header, 0);
    bytes.set(garbage, header.length);
    const result = await extractPdfText(bytes);
    expect(result).toMatchObject({ ok: false, kind: "unreadable" });
    if (!result.ok) expect(result.message.length).toBeGreaterThan(0);
  });

  it("gives unreadable for an empty Uint8Array", async () => {
    const result = await extractPdfText(new Uint8Array(0));
    expect(result).toMatchObject({ ok: false, kind: "unreadable" });
    if (!result.ok) expect(result.message.length).toBeGreaterThan(0);
  });
});

describe("does not consume input", () => {
  it("leaves the caller's bytes unchanged after extractPdfText", async () => {
    const bytes = readPdfFixture("BTBETRETF-2026-09-21.pdf");
    const copyBefore = new Uint8Array(bytes);
    const lengthBefore = bytes.byteLength;
    await extractPdfText(bytes);
    expect(bytes.byteLength).toBe(lengthBefore);
    expect(bytes).toEqual(copyBefore);
  });
});

describe("downloadReportPdf (AC4)", () => {
  let networkGuard: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    networkGuard = vi.fn(() => {
      throw new Error("network disabled in tests");
    });
    vi.stubGlobal("fetch", networkGuard);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("gives ok:true with the exact bytes and fetchedAt on a 200 PDF response", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const now = new Date("2026-09-23T10:00:00.000Z");
    vi.setSystemTime(now);

    const fixtureBytes = readPdfFixture("BTBETRETF-2026-09-21.pdf");
    const fetchImpl = vi.fn(
      async () => new Response(new Blob([fixtureBytes]), { status: 200, headers: { "content-type": "application/pdf" } }),
    );

    const result = await downloadReportPdf("https://example.test/a.pdf", { fetchImpl });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bytes).toBeInstanceOf(Uint8Array);
      expect(Buffer.from(result.bytes).equals(Buffer.from(fixtureBytes))).toBe(true);
      expect(result.fetchedAt.getTime()).toBe(now.getTime());
    }
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(networkGuard).not.toHaveBeenCalled();
  });

  it.each([404, 500])("gives http_error with httpStatus on %d", async (status) => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status }));
    const result = await downloadReportPdf("https://example.test/a.pdf", { fetchImpl });
    expect(result).toMatchObject({ ok: false, kind: "http_error", httpStatus: status });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("gives not_pdf when a 200 response's body is HTML, even labelled application/pdf", async () => {
    const html = "<html><body>error page</body></html>";
    const fetchImpl = vi.fn(
      async () => new Response(html, { status: 200, headers: { "content-type": "application/pdf" } }),
    );
    const result = await downloadReportPdf("https://example.test/a.pdf", { fetchImpl });
    expect(result).toMatchObject({ ok: false, kind: "not_pdf" });
  });

  it("gives ok:true when PDF bytes are served as application/octet-stream (header not required)", async () => {
    const fixtureBytes = readPdfFixture("TVBETETF-2026-09-21.pdf");
    const fetchImpl = vi.fn(
      async () => new Response(new Blob([fixtureBytes]), { status: 200, headers: { "content-type": "application/octet-stream" } }),
    );
    const result = await downloadReportPdf("https://example.test/a.pdf", { fetchImpl });
    expect(result.ok).toBe(true);
  });

  it("gives not_pdf for an empty 200 body", async () => {
    const fetchImpl = vi.fn(async () => new Response(new Blob([]), { status: 200 }));
    const result = await downloadReportPdf("https://example.test/a.pdf", { fetchImpl });
    expect(result).toMatchObject({ ok: false, kind: "not_pdf" });
  });

  it("gives network on a rejected fetch promise", async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new TypeError("fetch failed")));
    const result = await downloadReportPdf("https://example.test/a.pdf", { fetchImpl });
    expect(result).toMatchObject({ ok: false, kind: "network" });
    if (!result.ok) expect(result.message).toContain("fetch failed");
  });

  it("gives network when the body read rejects", async () => {
    const res = new Response(new Blob([new Uint8Array([1, 2, 3])]), { status: 200 });
    vi.spyOn(res, "arrayBuffer").mockRejectedValue(new Error("read failed"));
    const fetchImpl = vi.fn(async () => res);
    const result = await downloadReportPdf("https://example.test/a.pdf", { fetchImpl });
    expect(result).toMatchObject({ ok: false, kind: "network" });
  });

  it("gives timeout when slower than timeoutMs (fetch ignores the signal)", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(() => new Promise<Response>(() => {}));
    const promise = downloadReportPdf("https://example.test/a.pdf", { fetchImpl, timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;
    expect(result).toMatchObject({ ok: false, kind: "timeout" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("calls fetchImpl with the url, an AbortSignal, and PDF_REQUEST_HEADERS", async () => {
    const fixtureBytes = readPdfFixture("PTENGETF-2026-09-21.pdf");
    const fetchImpl = vi.fn(async () => new Response(new Blob([fixtureBytes]), { status: 200 }));
    await downloadReportPdf("https://example.test/a.pdf", { fetchImpl });
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe("https://example.test/a.pdf");
    expect(call[1]).toMatchObject({ headers: PDF_REQUEST_HEADERS, signal: expect.any(AbortSignal) });
    expect(PDF_REQUEST_HEADERS["User-Agent"]).toBe(BVB_REQUEST_HEADERS["User-Agent"]);
  });

  it("defaults fetchImpl to globalThis.fetch read at call time", async () => {
    const fixtureBytes = readPdfFixture("BTBETRETF-2026-09-21.pdf");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Blob([fixtureBytes]), { status: 200 })),
    );
    const result = await downloadReportPdf("https://example.test/a.pdf");
    expect(result.ok).toBe(true);
  });

  it("never calls the real fetch stub (AC5)", () => {
    expect(networkGuard).not.toHaveBeenCalled();
  });
});
