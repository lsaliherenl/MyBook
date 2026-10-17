import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { LanguageToggle } from "./language-switch";

export async function SiteFooter() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const f = t.footer;
  const link = "text-cream-2 no-underline hover:text-white";

  return (
    <footer className="bg-plum-900 text-cream-2">
      <div className="container-page pt-14 pb-8 sm:pt-22 sm:pb-10">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-9 sm:gap-12">
          <div className="flex flex-col gap-3.5">
            <span className="font-serif text-[26px] leading-none tracking-[.28em]">{t.brand.name}</span>
            <span className="eyebrow text-[9px] tracking-[.34em] text-mauve">{t.brand.tagline}</span>
            <span className="mt-2.5 font-serif text-[19px] leading-snug text-mauve-2">{f.about}</span>
          </div>

          <div className="flex flex-col gap-2.5 text-[15px] leading-normal">
            <span className="eyebrow mb-1 text-mauve">{f.visit}</span>
            <span>{t.brand.library}</span>
            <span className="text-mauve-2">
              {f.address}
              <br />
              {f.city}
            </span>
            <a href="https://www.google.com/maps/search/?api=1&query=university+central+library" target="_blank" rel="noopener" className="text-cream-2 underline-offset-4 hover:underline">
              {f.directions}
            </a>
          </div>

          <div className="flex flex-col gap-2.5 text-[15px]">
            <span className="eyebrow mb-1 text-mauve">{f.hours}</span>
            <span className="flex justify-between gap-4">
              <span>{f.weekdays}</span>
              <span>08:00–22:00</span>
            </span>
            <span className="flex justify-between gap-4">
              <span>{f.saturday}</span>
              <span>10:00–18:00</span>
            </span>
            <span className="flex justify-between gap-4 text-mauve">
              <span>{f.sunday}</span>
              <span>{f.closed}</span>
            </span>
            <span className="mt-1 text-[13px] text-mauve">{f.examWeeks}</span>
          </div>

          <nav aria-label={f.library} className="flex flex-col gap-2.5 text-[15px]">
            <span className="eyebrow mb-1 text-mauve">{f.library}</span>
            <Link href={`/${locale}/catalog`} className={link}>
              {t.nav.catalog}
            </Link>
            <Link href={`/${locale}/events`} className={link}>
              {t.nav.events}
            </Link>
            <Link href={`/${locale}/about#rules`} className={link}>
              {f.rules}
            </Link>
            <Link href={`/${locale}/about#accessibility`} className={link}>
              {f.accessibility}
            </Link>
            <Link href={`/${locale}/about#contact`} className={link}>
              {f.contact}
            </Link>
          </nav>

          <div className="flex flex-col gap-3.5">
            <span className="eyebrow text-mauve">{t.nav.language}</span>
            <Suspense fallback={<div className="h-11.5 w-52 border border-cream-2" />}>
              <LanguageToggle label={t.nav.language} names={t.nav.languageNames} />
            </Suspense>
          </div>
        </div>

        <div className="mt-14 flex flex-wrap justify-between gap-4 border-t border-cream-2/18 pt-6 text-[13px] text-mauve sm:mt-18">
          <span>{f.copyright}</span>
          <span className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href={`/${locale}/about#privacy`} className="text-mauve no-underline hover:text-cream-2">
              {f.privacy}
            </Link>
            <Link href={`/${locale}/about#accessibility`} className="text-mauve no-underline hover:text-cream-2">
              {f.accessibilityStatement}
            </Link>
            <Link href={`/${locale}/status`} className="text-mauve no-underline hover:text-cream-2">
              {f.status}
            </Link>
            <Link href={`/${locale}/admin`} className="text-mauve no-underline hover:text-cream-2">
              {t.nav.librarianDesk}
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
