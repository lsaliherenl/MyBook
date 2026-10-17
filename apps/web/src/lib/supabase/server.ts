import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { REMEMBER_COOKIE, remembers, sessionCookieOptions } from "./remember";

export function supabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set in the root .env");
  return { url, key };
}

/**
 * Supabase client bound to the request cookies (Server Components, Server Actions, Route Handlers).
 * `remember` overrides the stored "keep me signed in" choice, e.g. while signing in.
 */
export async function createSupabaseServerClient({ remember }: { remember?: boolean } = {}) {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();
  const persistent = remember ?? remembers(cookieStore.get(REMEMBER_COOKIE)?.value);
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, sessionCookieOptions(options, persistent));
        } catch {
          // Server Components cannot set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}
