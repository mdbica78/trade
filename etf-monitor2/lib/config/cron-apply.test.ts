import { afterEach, describe, expect, it, vi } from "vitest";
import { DEPLOY_HOOK_TIMEOUT_MS, requestRedeploy, saveCronHourAndApply } from "./cron-apply";
import type { CronConfigDeps } from "./cron";

const HOOK_URL = "https://hooks.example.test/deploy/prj_FAKE/HOOKSENTINEL";

function fakeOkResponse(status: number): Response {
  return new Response(null, { status });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("requestRedeploy (RR)", () => {
  it.each([undefined, "", "   "])("RR-1: a blank/undefined hook URL (%j) gives not_configured, fetch never called", async (url) => {
    const fetchImpl = vi.fn();
    const result = await requestRedeploy({ hookUrl: url, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toBe("not_configured");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([200, 201])("RR-2: a %d response gives applying; fetch is a single no-body POST with an AbortSignal", async (status) => {
    const fetchImpl = vi.fn(async () => fakeOkResponse(status));
    const result = await requestRedeploy({ hookUrl: HOOK_URL, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toBe("applying");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe(HOOK_URL);
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([400, 404, 429, 500])("RR-3: a %d response gives failed", async (status) => {
    const fetchImpl = vi.fn(async () => fakeOkResponse(status));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await requestRedeploy({ hookUrl: HOOK_URL, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toBe("failed");
    const lines = errSpy.mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => l.includes("HOOKSENTINEL"))).toBe(false);
    errSpy.mockRestore();
  });

  it("RR-4: a fetch rejection naming the URL gives failed, with no leak into the log", async () => {
    const fetchImpl = vi.fn(async () => {
      throw Object.assign(new TypeError(`fetch failed: ${HOOK_URL}`), { name: "TypeError" });
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await requestRedeploy({ hookUrl: HOOK_URL, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toBe("failed");
    const lines = errSpy.mock.calls.map((c) => String(c[0]));
    for (const line of lines) {
      expect(line).not.toContain(HOOK_URL);
      expect(line).not.toContain("HOOKSENTINEL");
    }
    errSpy.mockRestore();
  });

  it("RR-5: a hanging fetch is still pending at 9999ms and failed exactly at the 10000ms timeout", async () => {
    vi.useFakeTimers();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      });
    });
    const promise = requestRedeploy({ hookUrl: HOOK_URL, fetchImpl: fetchImpl as unknown as typeof fetch });
    let settled = false;
    void promise.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(9_999);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const result = await promise;
    expect(result).toBe("failed");
    const lines = errSpy.mock.calls.map((c) => String(c[0]));
    for (const line of lines) {
      expect(line).not.toContain(HOOK_URL);
    }
    errSpy.mockRestore();
  });

  it("RR-6: DEPLOY_HOOK_TIMEOUT_MS is 10 000", () => {
    expect(DEPLOY_HOOK_TIMEOUT_MS).toBe(10_000);
  });

  it("RR-7: the result is always one of the three closed strings; nothing ever returns or throws the URL", async () => {
    const outcomes: unknown[] = [];
    outcomes.push(await requestRedeploy({ hookUrl: undefined }));
    outcomes.push(
      await requestRedeploy({ hookUrl: HOOK_URL, fetchImpl: (async () => fakeOkResponse(200)) as unknown as typeof fetch }),
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    outcomes.push(
      await requestRedeploy({ hookUrl: HOOK_URL, fetchImpl: (async () => fakeOkResponse(500)) as unknown as typeof fetch }),
    );
    errSpy.mockRestore();
    for (const outcome of outcomes) {
      expect(["applying", "not_configured", "failed"]).toContain(outcome);
    }
  });
});

describe("saveCronHourAndApply (SA-U1)", () => {
  it("SA-U1: never calls redeploy when setCronHour rejects", async () => {
    let callCount = 0;
    const run = vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) return [[{ cron_hour_utc: 7 }]]; // getCronHour
      throw new Error("db unavailable"); // setCronHour's insert
    });
    const db = { execute: vi.fn((q: unknown) => q) } as unknown as CronConfigDeps["db"];
    const config: CronConfigDeps = { db, run: run as unknown as CronConfigDeps["run"] };
    const redeploy = vi.fn();
    await expect(saveCronHourAndApply("9", { config, redeploy })).rejects.toThrow("db unavailable");
    expect(redeploy).not.toHaveBeenCalled();
  });
});
