// Downloads for the importers. Files go through node:https rather than fetch():
// fetch() adds browser-only headers (sec-fetch-mode, accept-language) that some
// CDNs reject from servers, while a plain request with our name is accepted.
import http from "node:http";
import https from "node:https";

/** The usual crawler format ("Mozilla/5.0 (compatible; Name/version)"); it names us honestly. */
export const IMPORT_USER_AGENT = "Mozilla/5.0 (compatible; ArnoobaLibrary/1.0; free public-domain library)";

/** Downloads a remote file into memory, retrying once if the connection drops. */
export async function fetchFile(url: string, maxBytes: number, timeoutMs = 240_000, accept = "*/*"): Promise<Uint8Array> {
  try {
    return (await get(url, { maxBytes, timeoutMs, accept })).data;
  } catch (err) {
    if (err instanceof Error && err.message === TOO_LARGE) throw err;
    await sleep(2000);
    return (await get(url, { maxBytes, timeoutMs, accept })).data;
  }
}

/**
 * Downloads part of a file ("bytes=100-199" or "bytes=-500"), retrying once.
 * Rejects unless the server answers 206, so a server that ignores ranges never
 * sends the whole file by surprise. `start` is the offset of the first byte.
 */
export async function fetchRange(url: string, range: string, accept = "*/*", timeoutMs = 900_000): Promise<{ data: Uint8Array; start: number }> {
  const once = async () => {
    const res = await get(url, { maxBytes: 200 * 1024 * 1024, timeoutMs, accept, range });
    const start = Number(/^bytes (\d+)-\d+\/\d+$/.exec(res.contentRange ?? "")?.[1]);
    if (res.status !== 206 || !Number.isFinite(start)) throw new Error("range not supported");
    return { data: res.data, start };
  };
  try {
    return await once();
  } catch (err) {
    if (err instanceof Error && err.message === "range not supported") throw err;
    await sleep(2000);
    return once();
  }
}

export const TOO_LARGE = "الملف أكبر من الحد المسموح";

interface GetOptions {
  maxBytes: number;
  timeoutMs: number;
  accept: string;
  range?: string;
}

function get(url: string, opts: GetOptions, redirects = 5): Promise<{ status: number; contentRange?: string; data: Uint8Array }> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    if (target.protocol !== "https:" && target.protocol !== "http:") return reject(new Error("unsupported protocol"));
    const client = target.protocol === "https:" ? https : http;
    const headers: Record<string, string> = { "User-Agent": IMPORT_USER_AGENT, Accept: opts.accept };
    if (opts.range) headers.Range = opts.range;
    const req = client.get(target, { headers, timeout: opts.timeoutMs }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        if (redirects <= 0) return reject(new Error("too many redirects"));
        return get(new URL(res.headers.location, target).toString(), opts, redirects - 1).then(resolve, reject);
      }
      if (status < 200 || status >= 300) {
        res.resume();
        return reject(new Error(`HTTP ${status}`));
      }
      if (opts.range && status !== 206) {
        res.destroy();
        return resolve({ status, data: new Uint8Array() });
      }
      const declared = Number(res.headers["content-length"]);
      if (Number.isFinite(declared) && declared > opts.maxBytes) {
        res.destroy();
        return reject(new Error(TOO_LARGE));
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.byteLength;
        if (size > opts.maxBytes) {
          res.destroy();
          reject(new Error(TOO_LARGE));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () =>
        resolve({ status, contentRange: res.headers["content-range"], data: new Uint8Array(Buffer.concat(chunks)) }),
      );
      res.on("error", reject);
    });
    // Overall deadline, on top of the socket idle timeout.
    const deadline = setTimeout(() => req.destroy(new Error("timeout")), opts.timeoutMs);
    req.on("close", () => clearTimeout(deadline));
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** GETs JSON, retrying timeouts, network errors and 5xx a few times. */
export async function fetchJson<T>(url: string, timeoutMs = 45_000, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": IMPORT_USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return (await res.json()) as T;
      lastError = new Error(`HTTP ${res.status}`);
      if (res.status < 500 && res.status !== 429) break;
    } catch (err) {
      lastError = err;
    }
    if (attempt < attempts) await sleep(1500 * attempt);
  }
  throw lastError instanceof Error && lastError.name === "TimeoutError"
    ? new Error("انتهت مهلة الاتصال بالخادم")
    : lastError;
}
