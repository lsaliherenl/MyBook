import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";

// Temporary home page until the Claude Design screens are integrated.
export default async function HomePage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <section className="bg-plum-900 text-paper">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-8 sm:py-32">
        <h1 className="max-w-xl font-serif text-5xl leading-[1.05] sm:text-7xl">{t.home.title}</h1>
        <p className="mt-6 max-w-md font-serif text-xl text-paper/85">{t.home.subtitle}</p>
        <Link
          href={`/${locale}/register`}
          className="eyebrow mt-10 inline-block bg-paper px-6 py-4 text-ink hover:bg-paper-2"
        >
          {t.auth.registerLink} →
        </Link>
        <p className="mt-16 max-w-md text-sm text-paper/60">{t.home.notice}</p>
      </div>
    </section>
  );
}
