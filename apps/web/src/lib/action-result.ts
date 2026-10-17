import "server-only";
import { ApiError } from "./api";

/** What a librarian server action returns: the data, or the API's refusal code for the screen to translate. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function run<T>(call: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await call() };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { ok: false, error: error.code ?? "unknown" };
  }
}

export const post = (body: unknown, method = "POST") => ({ method, auth: true, body: JSON.stringify(body) });
