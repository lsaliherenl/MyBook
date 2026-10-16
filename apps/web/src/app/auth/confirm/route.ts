import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Landing point for links in Supabase e-mails (sign-up confirmation, password reset).
 * Handles both the PKCE `code` flow and `token_hash` templates, then continues to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const rawNext = searchParams.get("next") ?? "";
  const next = /^\/(tr|en)(\/|$)/.test(rawNext) && !rawNext.startsWith("//") ? rawNext : `/${DEFAULT_LOCALE}/account`;
  const locale = next.slice(1, 3);

  const supabase = await createSupabaseServerClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : { error: new Error("missing code") };

  if (error) return NextResponse.redirect(new URL(`/${locale}/login?error=link_invalid`, origin));
  return NextResponse.redirect(new URL(next, origin));
}
