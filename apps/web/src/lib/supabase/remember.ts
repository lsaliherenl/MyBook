/**
 * "Keep me signed in on this device". Supabase's auth cookies normally last 400 days; when the member
 * unticks the box at sign-in we drop their lifetime, so they become session cookies that the browser
 * clears when it closes. The choice itself is remembered in its own cookie for later token refreshes.
 */
export const REMEMBER_COOKIE = "MYBOOK_REMEMBER";

/** Only an explicit "0" means a short session; older sessions without the cookie stay persistent. */
export const remembers = (value: string | undefined) => value !== "0";

type CookieOptions = { maxAge?: number; expires?: Date } & Record<string, unknown>;

export function sessionCookieOptions<T extends CookieOptions>(options: T, remember: boolean): T {
  // A deleted cookie (maxAge 0) must stay deleted.
  if (remember || options.maxAge === 0) return options;
  return { ...options, maxAge: undefined, expires: undefined };
}
