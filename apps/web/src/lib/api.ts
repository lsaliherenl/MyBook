import "server-only";
import { createSupabaseServerClient } from "./supabase/server";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Calls the MyBook API from the server. With `auth: true` the signed-in user's Supabase
 * access token is forwarded; the API verifies it and looks up the user's role.
 */
export async function api<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const { auth, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("accept", "application/json");
  if (rest.body) headers.set("content-type", "application/json");

  if (auth) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new ApiError(401, "Not signed in");
    headers.set("authorization", `Bearer ${data.session.access_token}`);
  }

  const base = process.env.API_URL ?? "http://localhost:4000/api";
  const res = await fetch(`${base}${path}`, { ...rest, headers });
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText} for ${path}`);
  return (await res.json()) as T;
}
