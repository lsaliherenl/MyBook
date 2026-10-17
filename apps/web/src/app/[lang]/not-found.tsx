import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Shelf, SystemCopy, SystemShell } from "@/components/system/system-shell";
import { getLocale } from "@/i18n/get-dictionary";
import { SYSTEM_TEXT } from "@/i18n/system";

export const metadata: Metadata = { title: "404", robots: { index: false } };

/** A13 / A12: shown for unknown addresses and for books or events that don't exist. */
export default async function NotFound() {
  const locale = await getLocale();
  const s = SYSTEM_TEXT[locale];
  return (
    <SystemShell locale={locale}>
      <Shelf kind="notFound" />
      <SystemCopy kind="notFound" locale={locale}>
        <form role="search" action={`/${locale}/catalog`} className="mt-1.5 flex h-15 items-center gap-3 border border-line bg-paper-3 pr-2 pl-4.5">
          <Search aria-hidden size={20} strokeWidth={1.5} className="flex-none" />
          <label htmlFor="nf-q" className="sr-only">
            {s.searchPlaceholder}
          </label>
          <input id="nf-q" name="q" type="search" placeholder={s.searchPlaceholder} className="min-w-0 flex-1 border-0 bg-transparent font-serif text-[21px] text-ink outline-none" />
          <button type="submit" className="eyebrow h-11 bg-plum-700 px-4.5 text-[11px] text-paper hover:bg-plum-900">
            {s.search}
          </button>
        </form>
        <div className="flex flex-wrap gap-x-7 gap-y-3 text-[15px]">
          <Link href={`/${locale}`} className="text-ink underline underline-offset-4 hover:text-plum-500">
            {s.home}
          </Link>
          <Link href={`/${locale}/catalog`} className="text-ink underline underline-offset-4 hover:text-plum-500">
            {s.browse}
          </Link>
          <a href={`mailto:kutuphane@mybook.edu.tr?subject=${encodeURIComponent(s.report)}`} className="text-ink underline underline-offset-4 hover:text-plum-500">
            {s.report}
          </a>
        </div>
      </SystemCopy>
    </SystemShell>
  );
}
