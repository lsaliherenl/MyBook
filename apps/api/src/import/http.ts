import { Agent, fetch } from 'undici';
import { FORCE_IPV4 } from '../network.js';

// Open Library can be slow to accept connections, longer than fetch's default connect timeout,
// so external calls get their own agent.
const agent = new Agent({
  connect: { timeout: 30_000, ...(FORCE_IPV4 ? { family: 4 } : {}) },
  headersTimeout: 30_000,
  bodyTimeout: 30_000,
});

const USER_AGENT = 'MyBook/0.1 (university library project; https://github.com/lsaliherenl/MyBook)';
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);

export class HttpError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`HTTP ${status} from ${new URL(url).host}`);
  }
}

interface RequestOptions {
  /** Total time budget including retries. */
  timeoutMs?: number;
  attempts?: number;
}

async function request(url: string, { timeoutMs = 20_000, attempts = 3 }: RequestOptions = {}) {
  const deadline = Date.now() + timeoutMs;
  for (let attempt = 1; ; attempt++) {
    const remaining = deadline - Date.now();
    const res = await fetch(url, {
      dispatcher: agent,
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(Math.max(remaining, 1)),
    });
    if (res.ok) return res;
    // Google Books answers 503 intermittently for valid queries; a short backoff usually fixes it.
    const backoff = 500 * 2 ** (attempt - 1);
    if (!RETRY_STATUS.has(res.status) || attempt >= attempts || Date.now() + backoff >= deadline) {
      throw new HttpError(res.status, url);
    }
    await res.body?.cancel();
    await new Promise((r) => setTimeout(r, backoff));
  }
}

export async function getJson<T>(url: string, options?: RequestOptions): Promise<T> {
  const res = await request(url, options);
  return (await res.json()) as T;
}

export async function getBuffer(url: string, options?: RequestOptions): Promise<{ body: Buffer; contentType: string | null }> {
  const res = await request(url, options);
  return { body: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') };
}
