import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/[lang]/(auth)/actions";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LanguageSwitch } from "./language-switch";

export async function SiteHeader() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const signInLink = (
    <Link href={`/${locale}/login`} className="eyebrow text-ink hover:text-plum-500">
      {t.nav.signIn}
    </Link>
  );

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-5 sm:px-8">
        <Link href={`/${locale}`} className="group">
          <span className="block font-serif text-2xl tracking-[0.3em]">MY / BOOK</span>
          <span className="eyebrow block text-[9px] text-ink-muted">{t.brand.tagline}</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <span className="hidden text-ink-muted sm:inline">{t.nav.catalog}</span>
          <span className="hidden text-ink-muted sm:inline">{t.nav.events}</span>
          <LanguageSwitch label={t.nav.language} />
          <Suspense fallback={signInLink}>
            <UserNav fallback={signInLink} accountLabel={t.nav.account} signOutLabel={t.nav.signOut} />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

async function UserNav({
  fallback,
  accountLabel,
  signOutLabel,
}: {
  fallback: React.ReactNode;
  accountLabel: string;
  signOutLabel: string;
}) {
  const locale = await getLocale();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return fallback;

  return (
    <div className="flex items-center gap-4">
      <Link href={`/${locale}/account`} className="eyebrow text-ink hover:text-plum-500">
        {accountLabel}
      </Link>
      <form action={signOut}>
        <input type="hidden" name="lang" value={locale} />
        <button type="submit" className="eyebrow text-ink-muted hover:text-plum-500">
          {signOutLabel}
        </button>
      </form>
    </div>
  );
}
