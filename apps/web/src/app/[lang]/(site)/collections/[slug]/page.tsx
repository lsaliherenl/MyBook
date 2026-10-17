import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogCard } from "@/components/book-card";
import { KIND_ICONS, KIND_TINT } from "@/components/collections/collection-art";
import { format, getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getCollection } from "@/lib/catalog";
import { formatNumber, localized } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/[lang]/collections/[slug]">): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getLocale()]);
  const collection = await getCollection(slug);
  if (!collection) return {};
  return { title: localized(collection, "title", locale), description: localized(collection, "description", locale) ?? undefined };
}

/** One collection: what it is and who made it, then every book on the shelf. */
export default async function CollectionPage({ params }: PageProps<"/[lang]/collections/[slug]">) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <CollectionView params={params} />
    </Suspense>
  );
}

async function CollectionView({ params }: { params: PageProps<"/[lang]/collections/[slug]">["params"] }) {
  const { slug } = await params;
  const [t, locale, collection] = await Promise.all([getDictionary(), getLocale(), getCollection(slug)]);
  if (!collection) notFound();
  const c = t.collections;
  const curator = localized(collection, "curator", locale);
  const Icons = KIND_ICONS[collection.kind];
  const count = collection.bookCount === 1 ? c.oneBook : format(c.books, { count: formatNumber(collection.bookCount, locale) });

  return (
    <>
      <section className={`border-b border-line ${KIND_TINT[collection.kind]}`}>
        <div className="container-page flex flex-wrap items-end justify-between gap-x-12 gap-y-6 pt-12 pb-12 sm:pt-14 sm:pb-13">
          <div className="flex max-w-180 flex-col gap-3.5">
            <nav aria-label={c.breadcrumb} className="flex flex-wrap gap-x-2 text-[13px] text-ink-muted">
              <Link href={`/${locale}`} className="text-ink-muted no-underline hover:text-ink">
                {t.nav.home}
              </Link>
              <span aria-hidden>/</span>
              <Link href={`/${locale}/collections`} className="text-ink-muted no-underline hover:text-ink">
                {c.title}
              </Link>
              <span aria-hidden>/</span>
              <span aria-current="page">{localized(collection, "title", locale)}</span>
            </nav>
            <span className="eyebrow flex items-center gap-3 text-plum-500">
              {c.kinds[collection.kind]} · {count}
              <span aria-hidden className="inline-flex gap-2">
                {Icons.map((Icon, i) => (
                  <Icon key={i} size={16} strokeWidth={1.5} />
                ))}
              </span>
            </span>
            <h1 className="m-0 animate-rise font-serif text-[48px] leading-[.98] font-light sm:text-[clamp(56px,6vw,80px)]">{localized(collection, "title", locale)}</h1>
            {localized(collection, "description", locale) && (
              <p className="m-0 text-[17px] leading-[1.6] font-light text-ink-muted">{localized(collection, "description", locale)}</p>
            )}
          </div>
          {curator && <span className="text-sm text-ink-muted">{curator}</span>}
        </div>
      </section>

      <section aria-label={localized(collection, "title", locale)} className="container-page pt-12 pb-20 sm:pt-16 sm:pb-26">
        {collection.books.length === 0 ? (
          <p className="m-0 text-[15px] text-ink-muted">{c.emptyCollection}</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4.5 gap-y-8 sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] sm:gap-x-9 sm:gap-y-14">
            {collection.books.map((book, i) => (
              <CatalogCard key={book.id} book={book} locale={locale} t={t.book} priority={i < 4} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
