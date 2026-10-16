import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE, localeFromAcceptLanguage } from "./i18n/config";

/** Pages under these paths need a signed-in user. */
const PROTECTED = ["/account"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const [, first, ...rest] = pathname.split("/");

  // 1. Every page lives under /tr or /en.
  if (!isLocale(first)) {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale = isLocale(cookieLocale) ? cookieLocale : localeFromAcceptLanguage(request.headers.get("accept-language"));
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  // 2. Refresh the Supabase session cookies on every request.
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getClaims();

  // 3. Protected pages send signed-out visitors to the login page and back afterwards.
  const pagePath = `/${rest.join("/")}`;
  if (!data?.claims && PROTECTED.some((p) => pagePath === p || pagePath.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = `/${first}/login`;
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  response.cookies.set(LOCALE_COOKIE, first, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals, the auth callback and files with an extension.
    "/((?!_next/|auth/|.*\\.[\\w]+$).*)",
  ],
};
