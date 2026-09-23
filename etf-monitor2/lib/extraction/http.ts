export type FetchOnceResult<T> =
  | { ok: true; value: T; status: number; finalUrl: string }
  | { ok: false; kind: "http_error"; message: string; httpStatus: number }
  | { ok: false; kind: "network"; message: string }
  | { ok: false; kind: "timeout"; message: string };

export type FetchOnceOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs: number;
  headers?: Record<string, string>;
};

/**
 * One attempt, never throws. Races the whole call (request + body read) against a timer so a
 * mock (or a real server) that ignores AbortSignal still times out.
 */
export async function fetchOnce<T>(
  url: string,
  read: (res: Response) => Promise<T>,
  opts: FetchOnceOptions,
): Promise<FetchOnceResult<T>> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new Error(`timed out after ${opts.timeoutMs}ms`));
    }, opts.timeoutMs);
  });

  try {
    const run = (async (): Promise<FetchOnceResult<T>> => {
      const res = await fetchImpl(url, { headers: opts.headers, signal: controller.signal });
      const finalUrl = res.url || url;

      if (!res.ok) {
        try {
          await res.body?.cancel();
        } catch {
          // best-effort only
        }
        return {
          ok: false,
          kind: "http_error",
          message: `HTTP ${res.status} for ${url}`,
          httpStatus: res.status,
        };
      }

      const value = await read(res);
      return { ok: true, value, status: res.status, finalUrl };
    })();

    return await Promise.race([run, timeoutPromise]);
  } catch (error) {
    if (timedOut) {
      return { ok: false, kind: "timeout", message: `timed out after ${opts.timeoutMs}ms for ${url}` };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, kind: "network", message: `${message} for ${url}` };
  } finally {
    clearTimeout(timer);
  }
}
