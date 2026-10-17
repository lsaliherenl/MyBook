import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CollectionSummaryDto } from "@mybook/shared";
import { BookCover } from "@/components/book-cover";
import { CollectionFilter } from "@/components/collections/collection-filter";
import { CoverStack, KIND_ICONS } from "@/components/collections/collection-art";
import { FormMessage } from "@/components/form";
import type { Locale } from "@/i18n/config";
import { format, getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { getCollections } from "@/lib/catalog";
import { formatNumber, localized } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.collections.title, description: t.collections.intro };
}

/** A2b: every published collection — the featured one as a plum band, the rest as a filterable grid. */
export default async function CollectionsPage() {
  const [t, locale, collections] = await Promise.all([getDictionary(), getLocale(), getCollections()]);
  const c = t.collections;
  const list = collections ?? [];
  const featured = list.find((x) => x.featured) ?? null;
  const rest = list.filter((x) => x !== featured);
  const kinds = [...new Set(rest.map((x) => x.kind))];

  return (
    <>
      <section className="border-b border-line bg-paper-2">
        <div className="container-page flex flex-wrap items-end justify-between gap-x-12 gap-y-6 pt-12 pb-12 sm:pt-14 sm:pb-13">
          <div className="flex max-w-160 flex-col gap-3.5">
            <nav aria-label={c.breadcrumb} className="text-[13px] text-ink-muted">
              <Link href={`/${locale}`} className="text-ink-muted no-underline hover:text-ink">
                {t.nav.home}
              </Link>{" "}
              <span aria-hidden>/</span> <span aria-current="page">{c.title}</span>
            </nav>
            <span className="eyebrow text-plum-500">{c.eyebrow}</span>
            <h1 className="m-0 animate-rise font-serif text-[56px] leading-[.96] font-light sm:text-[clamp(56px,6vw,84px)]">{c.title}</h1>
            <p className="m-0 text-[17px] leading-[1.6] font-light text-ink-muted">{c.intro}</p>
          </div>
          {list.length > 0 && <span className="text-sm text-ink-muted">{format(c.count, { count: formatNumber(list.length, locale) })}</span>}
        </div>
      </section>

      {!collections && (
        <div className="container-page pt-14">
          <FormMessage tone="error">{c.unavailable}</FormMessage>
        </div>
      )}

      {featured && <Featured collection={featured} t={t} locale={locale} />}

      {rest.length > 0 && (
        <section aria-labelledby="h-all" className="container-page pt-12 pb-20 sm:pb-26">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <h2 id="h-all" className="m-0 mb-5 font-serif text-[40px] font-normal">
              {c.all}
            </h2>
            <CollectionFilter
              label={c.filterLabel}
              chips={[{ kind: "ALL", label: c.kinds.ALL }, ...kinds.map((kind) => ({ kind, label: c.kinds[kind] }))]}
              cards={rest.map((x) => ({ id: x.slug, kind: x.kind, card: <CollectionCard collection={x} t={t} locale={locale} /> }))}
              empty={c.empty}
            />
          </div>
        </section>
      )}

      <section className="bg-paper-2">
        <div className="container-page flex flex-wrap items-center justify-between gap-5 py-14">
          <div className="flex flex-col gap-2">
            <span className="font-serif text-[30px]">{c.teachTitle}</span>
            <span className="text-[15px] text-ink-muted">{c.teachText}</span>
          </div>
          <Link
            href={`/${locale}/about#contact`}
            className="eyebrow inline-flex h-12 items-center border border-ink px-5.5 text-[11px] text-ink no-underline hover:bg-ink hover:text-paper"
          >
            {c.contact}
          </Link>
        </div>
      </section>
    </>
  );
}

const bookCount = (n: number, t: Dictionary["collections"], locale: Locale) => (n === 1 ? t.oneBook : format(t.books, { count: formatNumber(n, locale) }));

function Featured({ collection, t, locale }: { collection: CollectionSummaryDto; t: Dictionary; locale: Locale }) {
  const c = t.collections;
  const Icons = KIND_ICONS[collection.kind];
  const fan = ["left-[18%] top-[15%] w-37.5 -rotate-8", "left-[38%] top-[10%] w-40 rotate-2 z-1", "left-[58%] top-[18%] w-37.5 rotate-9"];
  return (
    <section aria-labelledby="h-feat" className="container-page pt-16 pb-6">
      <Link href={`/${locale}/collections/${collection.slug}`} className="group relative flex flex-wrap items-stretch bg-plum-700 text-cream no-underline">
        <div aria-hidden className="relative min-h-85 flex-[1_1_420px] overflow-hidden bg-plum-900">
          {collection.covers.map((book, i) => (
            <span key={book.id} className={`absolute transition-transform duration-500 ease-out-soft group-hover:-translate-y-2 ${fan[i]}`}>
              <BookCover book={book} sizes="160px" className="w-full" />
            </span>
          ))}
        </div>
        <div className="flex flex-[1_1_420px] flex-col justify-center gap-4 px-6 py-10 sm:px-13 sm:py-12">
          <span className="hover-icons absolute top-7 right-8 hidden gap-2.5 text-[#e6d6de] sm:inline-flex">
            {Icons.map((Icon, i) => (
              <Icon key={i} aria-hidden size={22} strokeWidth={1.5} />
            ))}
          </span>
          <span className="eyebrow text-[#d8c2cf]">{format(c.featured, { count: bookCount(collection.bookCount, c, locale) })}</span>
          <h2 id="h-feat" className="m-0 font-serif text-[40px] leading-[1.02] font-light sm:text-[48px]">
            {localized(collection, "title", locale)}
          </h2>
          <p className="m-0 text-base leading-[1.65] font-light text-[#e6d6de]">{localized(collection, "description", locale)}</p>
          <span className="eyebrow mt-2 inline-flex items-center gap-2.5 text-[11px]">
            {c.browse}
            <ArrowRight aria-hidden size={16} strokeWidth={1.5} className="transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </Link>
    </section>
  );
}

function CollectionCard({ collection, t, locale }: { collection: CollectionSummaryDto; t: Dictionary; locale: Locale }) {
  const c = t.collections;
  const curator = localized(collection, "curator", locale);
  return (
    <Link href={`/${locale}/collections/${collection.slug}`} className="group flex flex-col gap-2.5 text-ink no-underline">
      <CoverStack books={collection.covers} kind={collection.kind} />
      <span className="eyebrow text-[10px] text-plum-500">
        {c.kinds[collection.kind]} · {bookCount(collection.bookCount, c, locale)}
      </span>
      <span className="font-serif text-[28px] leading-[1.1] underline decoration-transparent decoration-1 underline-offset-6 transition-colors duration-300 group-hover:text-plum-500 group-hover:decoration-plum-500">{localized(collection, "title", locale)}</span>
      <span className="text-[15px] leading-[1.55] text-ink-muted">{localized(collection, "description", locale)}</span>
      {curator && <span className="text-[13px] text-ink-muted">{curator}</span>}
    </Link>
  );
}
