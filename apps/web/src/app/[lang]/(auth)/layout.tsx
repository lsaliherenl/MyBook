import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { LanguageLinks, LanguageSwitch } from "@/components/language-switch";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";

/** Sign-in pages (A6): a photo half with the brand, and the form half. On phones the photo is a short band on top. */
export default async function AuthLayout({ children }: LayoutProps<"/[lang]">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const languages = (className: string) => (
    <Suspense fallback={<LanguageLinks label={t.nav.language} current={locale} className={className} />}>
      <LanguageSwitch label={t.nav.language} className={className} />
    </Suspense>
  );

  return (
    <div className="flex min-h-[max(900px,100vh)] flex-col md:flex-row">
      <div className="relative flex h-52.5 flex-col overflow-hidden bg-[#3A1B2E] px-5 py-5.5 text-cream md:h-auto md:min-h-105 md:flex-[1_1_520px] md:gap-[clamp(56px,9vh,112px)] md:px-[clamp(24px,4vw,56px)] md:py-10">
        <Image src="/images/auth-window.jpg" alt="" fill priority sizes="(max-width: 768px) 100vw, 50vw" className="animate-zoom object-cover object-[center_64%]" />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(46,20,36,.78)_0%,rgba(46,20,36,.3)_55%,rgba(46,20,36,.12)_100%)] md:bg-[linear-gradient(100deg,rgba(46,20,36,.88)_0%,rgba(46,20,36,.66)_40%,rgba(46,20,36,.2)_72%,rgba(46,20,36,.06)_100%),linear-gradient(180deg,rgba(46,20,36,.4)_0%,rgba(46,20,36,0)_28%)]"
        />
        <div className="relative flex items-start justify-between">
          <Link href={`/${locale}`} className="flex flex-col gap-1.25 text-cream no-underline md:gap-1.75">
            <span className="font-serif text-xl leading-none tracking-[.26em] md:text-[28px] md:tracking-[.3em]">{t.brand.name}</span>
            <span className="eyebrow text-[7px] tracking-[.32em] text-[#D8C2CF] md:text-[9px] md:tracking-[.36em]">{t.brand.tagline}</span>
          </Link>
          <div className="-mt-3 md:hidden [&_a]:text-cream [&_a[aria-current]]:decoration-cream">{languages("inline-flex")}</div>
        </div>
        <div className="relative hidden max-w-115 flex-col gap-4.5 md:flex">
          <span className="font-serif text-[clamp(40px,3.6vw,56px)] leading-[1.02] font-light">{t.auth.photoTitle}</span>
          <span className="text-[15px] text-[#E3D3DB]">{t.auth.photoText}</span>
        </div>
      </div>

      <main className="flex flex-col px-5 pt-6 pb-10 md:flex-[1_1_520px] md:px-[clamp(24px,5vw,80px)] md:pt-8">
        <div className="hidden justify-end md:flex">{languages("inline-flex")}</div>
        <div className="flex flex-1 justify-center md:items-center md:py-8">
          <div className="flex w-full max-w-110 flex-col gap-6 md:gap-7">{children}</div>
        </div>
        <p className="m-0 mt-8 text-center text-[13px] text-ink-muted">{t.auth.trouble}</p>
        <Link href={`/${locale}/admin`} className="eyebrow mt-3 self-center text-[10px] text-plum-500 no-underline hover:text-plum-700 md:self-start">
          {t.auth.librarian}
        </Link>
      </main>
    </div>
  );
}
