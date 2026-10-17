import Link from "next/link";
import { Suspense } from "react";
import { Search } from "lucide-react";
import { format, getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { readBag } from "@/lib/bag";
import { initials } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BagButton, OpenBagButton } from "./bag/bag-drawer";
import { LanguageLinks, LanguageSwitch } from "./language-switch";
import { MainNav, MobileMenu, NavLinks } from "./main-nav";

interface Viewer {
  name: string;
  initials: string;
}

async function getViewer(): Promise<Viewer | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  const meta = (data.claims.user_metadata ?? {}) as { full_name?: string };
  const full = meta.full_name?.trim() || String(data.claims.email ?? "").split("@")[0];
  return { name: full.split(/\s+/)[0], initials: initials(full) };
}

export async function SiteHeader() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const links = [
    { href: `/${locale}/catalog`, label: t.nav.catalog },
    { href: `/${locale}/collections`, label: t.nav.collections },
    { href: `/${locale}/events`, label: t.nav.events },
    { href: `/${locale}/about`, label: t.nav.about },
  ];

  return (
    <header className="relative z-50 bg-paper">
      <div className="container-page flex items-center justify-between gap-x-10 gap-y-5 py-3.5 pr-2 sm:py-6.5 sm:pr-[clamp(20px,5.5vw,80px)]">
        <Link href={`/${locale}`} className="flex shrink-0 flex-col gap-1.25 whitespace-nowrap text-ink no-underline sm:gap-1.75">
          <span className="font-serif text-lg leading-none tracking-[.24em] sm:text-[28px] sm:tracking-[.3em]">{t.brand.name}</span>
          <span className="eyebrow text-[7px] tracking-[.32em] text-ink-muted sm:text-[9px] sm:tracking-[.36em]">{t.brand.tagline}</span>
        </Link>

        <Suspense fallback={<NavLinks label={t.nav.main} links={links} />}>
          <MainNav label={t.nav.main} links={links} />
        </Suspense>

        <div className="flex items-center sm:gap-1">
          <Link
            href={`/${locale}/catalog#search`}
            aria-label={t.nav.search}
            className="inline-flex size-11 items-center justify-center text-ink hover:text-plum-500"
          >
            <Search aria-hidden size={22} strokeWidth={1.5} />
          </Link>
          <Suspense fallback={<BagButton count={0} label={t.nav.bag} />}>
            <HeaderBag t={t} />
          </Suspense>
          <Suspense fallback={<SignInLink t={t} locale={locale} />}>
            <HeaderAccount t={t} locale={locale} />
          </Suspense>
          <span aria-hidden className="hidden h-4.5 w-px bg-line lg:block" />
          <Suspense fallback={<LanguageLinks label={t.nav.language} current={locale} className="hidden pl-1.5 lg:inline-flex" />}>
            <LanguageSwitch label={t.nav.language} className="hidden pl-1.5 lg:inline-flex" />
          </Suspense>
          <Suspense fallback={null}>
            <PhoneMenu t={t} locale={locale} links={links} />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function HeaderBag({ t }: { t: Dictionary }) {
  const count = (await readBag()).length;
  return <BagButton count={count} label={count === 1 ? t.nav.bagWithOne : count ? format(t.nav.bagWithCount, { count: String(count) }) : t.nav.bag} />;
}

function SignInLink({ t, locale }: { t: Dictionary; locale: Locale }) {
  return (
    <Link href={`/${locale}/login`} className="eyebrow hidden px-3.5 text-xs leading-11 text-ink no-underline hover:text-plum-500 lg:block">
      {t.nav.signIn}
    </Link>
  );
}

async function HeaderAccount({ t, locale }: { t: Dictionary; locale: Locale }) {
  const viewer = await getViewer();
  if (!viewer) return <SignInLink t={t} locale={locale} />;
  return (
    <Link
      href={`/${locale}/account`}
      aria-label={`${t.nav.account}, ${viewer.name}`}
      className="hidden h-11 items-center gap-2.5 px-2 text-ink no-underline hover:text-plum-500 lg:inline-flex"
    >
      <span className="inline-flex size-8 items-center justify-center rounded-full bg-plum-700 font-serif text-[15px] font-medium text-paper">
        {viewer.initials}
      </span>
      <span className="text-[15px]">{viewer.name}</span>
    </Link>
  );
}

async function PhoneMenu({ t, locale, links }: { t: Dictionary; locale: Locale; links: { href: string; label: string }[] }) {
  const viewer = await getViewer();
  return (
    <MobileMenu label={t.nav.menu} openLabel={t.nav.openMenu}>
      <span className="eyebrow px-5.5 pt-1 pb-2.5 text-[9px] text-ink-muted">{t.nav.menu}</span>
      <Link href={`/${locale}`}>{t.nav.home}</Link>
      {links.map((l) => (
        <Link key={l.href} href={l.href}>
          {l.label}
        </Link>
      ))}
      <span aria-hidden className="mx-5.5 my-2 h-px bg-line" />
      {viewer && <Link href={`/${locale}/account`}>{t.nav.account}</Link>}
      {viewer && <Link href={`/${locale}/account/loans`}>{t.nav.loans}</Link>}
      <OpenBagButton>{t.nav.bag}</OpenBagButton>
      {!viewer && <Link href={`/${locale}/login`}>{t.nav.signIn}</Link>}
      <span className="mx-5.5 mt-2 flex items-center border-t border-line pt-1">
        <Suspense fallback={<LanguageLinks label={t.nav.language} current={locale} className="-ml-2 inline-flex" />}>
          <LanguageSwitch label={t.nav.language} className="-ml-2 inline-flex" />
        </Suspense>
      </span>
    </MobileMenu>
  );
}
