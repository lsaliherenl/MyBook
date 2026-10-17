import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BookSummaryDto } from "@mybook/shared";
import { AddToBagButton } from "@/components/bag/add-to-bag-button";
import { AvailabilityBadge, bookHref, CatalogCard } from "@/components/book-card";
import { BookCover } from "@/components/book-cover";
import { CatalogNavProvider, ResultsFrame } from "@/components/catalog/catalog-nav";
import { CatalogFilters } from "@/components/catalog/filters";
import { CatalogSearchForm } from "@/components/catalog/search-form";
import { CatalogToolbar } from "@/components/catalog/toolbar";
import { TodaysHours } from "@/components/todays-hours";
import type { Locale } from "@/i18n/config";
import { format, getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { readBag } from "@/lib/bag";
import { getBooks, getCategories, getFacets } from "@/lib/catalog";
import { CATALOG_PAGE_SIZE, catalogApiQuery, catalogSearch, parseCatalogParams, type CatalogParams } from "@/lib/catalog-params";
import { formatNumber, languageName, localized } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.catalog.title };
}

export default async function CatalogPage({ searchParams }: PageProps<"/[lang]/catalog">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<CatalogSkeleton t={t} locale={locale} />}>
      <Catalog searchParams={searchParams} t={t} locale={locale} />
    </Suspense>
  );
}

async function Catalog({ searchParams, t, locale }: { searchParams: PageProps<"/[lang]/catalog">["searchParams"]; t: Dictionary; locale: Locale }) {
  const params = parseCatalogParams(await searchParams);
  const query = catalogApiQuery(params);
  const [page, facets, categories, bag] = await Promise.all([
    getBooks({ ...query, sort: params.sort, page: params.page, pageSize: CATALOG_PAGE_SIZE }),
    getFacets(query),
    getCategories(),
    readBag(),
  ]);
  const c = t.catalog;

  const categoryName = new Map(categories.map((cat) => [cat.slug, localized(cat, "name", locale)]));
  const names: Record<string, string> = { available: c.availableNow };
  for (const [slug, name] of categoryName) names[`category:${slug}`] = name;
  for (const l of facets?.languages ?? []) names[`language:${l.code}`] = languageName(l.code, locale);
  for (const a of facets?.authors ?? []) names[`author:${a.slug}`] = a.name;
  // Keep chips readable for selected values that dropped out of the facet lists.
  for (const code of params.language) names[`language:${code}`] ??= languageName(code, locale);

  const total = page?.total ?? 0;
  const countLabel = total === 1 ? c.resultsOne : format(c.results, { count: formatNumber(total, locale) });

  return (
    <CatalogNavProvider params={params}>
      <CatalogHead t={t} locale={locale} catalogTotal={facets?.catalogTotal}>
        <CatalogSearchForm label={c.searchLabel} placeholder={c.searchPlaceholder} button={c.searchButton} />
      </CatalogHead>

      <div className="container-page pt-7">
        <CatalogToolbar countLabel={countLabel} names={names} labels={c} />
      </div>

      <div className="container-page flex flex-wrap items-start gap-8 pt-6 pb-24 md:gap-14 md:pt-10 md:pb-30">
        <CatalogFilters
          labels={{ ...c, toggle: c.filtersToggle }}
          categories={(facets?.categories ?? []).map((f) => ({ value: f.slug, label: categoryName.get(f.slug) ?? f.slug, count: f.count }))}
          languages={(facets?.languages ?? []).map((f) => ({ value: f.code, label: languageName(f.code, locale), count: f.count }))}
          authors={(facets?.authors ?? []).map((f) => ({ value: f.slug, label: f.name, count: f.count }))}
        />
        <ResultsFrame label={c.loading}>
          {!page ? (
            <p className="m-0 border border-line bg-paper-3 p-8 text-ink-muted">{t.common.apiDown}</p>
          ) : page.items.length === 0 ? (
            <EmptyShelf t={t} locale={locale} params={params} />
          ) : params.view === "list" ? (
            <div className="flex animate-swap flex-col border-t border-line">
              {page.items.map((book) => (
                <CatalogRow key={book.id} book={book} t={t} locale={locale} inBag={bag.includes(book.id)} />
              ))}
            </div>
          ) : (
            <div className="grid animate-swap grid-cols-2 gap-x-4.5 gap-y-8 sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] sm:gap-x-9 sm:gap-y-14">
              {page.items.map((book, i) => (
                <CatalogCard key={book.id} book={book} locale={locale} t={t.book} priority={i < 4} />
              ))}
            </div>
          )}
          {page && page.items.length > 0 && <Pagination t={t} params={params} total={total} totalPages={page.totalPages} />}
        </ResultsFrame>
      </div>
    </CatalogNavProvider>
  );
}

function CatalogHead({ t, locale, catalogTotal, children }: { t: Dictionary; locale: Locale; catalogTotal?: number; children: React.ReactNode }) {
  const c = t.catalog;
  return (
    <section className="bg-paper-2">
      <div className="container-page flex flex-col gap-6 pt-8 pb-8 sm:gap-7 sm:pt-12 sm:pb-10">
        <nav aria-label={c.breadcrumb} className="flex gap-3 text-sm">
          <Link href={`/${locale}`} className="text-ink-muted no-underline hover:text-plum-500">
            {t.nav.home}
          </Link>
          <span aria-hidden className="text-line">
            /
          </span>
          <span aria-current="page">{t.nav.catalog}</span>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="m-0 font-serif text-[48px] leading-[.95] font-light sm:text-[clamp(56px,6vw,84px)]">{c.title}</h1>
          {catalogTotal !== undefined && (
            <span className="text-[15px] text-ink-muted">
              {format(c.summary, { count: formatNumber(catalogTotal, locale), hours: "" })}
              <TodaysHours openUntil={c.openUntil} closedToday={c.closedToday} />
            </span>
          )}
        </div>
        <div id="search" className="scroll-mt-6">
          {children}
        </div>
      </div>
    </section>
  );
}

function CatalogRow({ book, t, locale, inBag }: { book: BookSummaryDto; t: Dictionary; locale: Locale; inBag: boolean }) {
  const shelf = book.availability.available > 0 ? t.catalog.addToBag : t.catalog.joinWaitlist;
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-5 border-b border-line py-5.5">
      <Link href={bookHref(locale, book.slug)} className="flex-none">
        <BookCover book={book} sizes="72px" className="w-18" />
      </Link>
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
        <Link href={bookHref(locale, book.slug)} lang={book.language} className="font-serif text-[26px] leading-[1.1] text-ink no-underline hover:text-plum-500">
          {book.title}
        </Link>
        <span className="text-[15px] text-ink-muted">
          {[book.authors.map((a) => a.name).join(", "), book.publishedYear, languageName(book.language, locale)].filter(Boolean).join(" · ")}
        </span>
        {book.categories[0] && <span className="text-[13px] text-ink-muted">{localized(book.categories[0], "name", locale)}</span>}
      </div>
      <span className="w-44 flex-none">
        <AvailabilityBadge book={book} t={t.book} locale={locale} />
      </span>
      <AddToBagButton
        bookId={book.id}
        inBag={inBag}
        label={shelf}
        inBagLabel={t.catalog.inBag}
        fullLabel={t.catalog.bagFull}
        className="eyebrow inline-flex h-11 flex-none items-center border border-ink px-4.5 text-[11px] text-ink hover:bg-ink hover:text-paper"
      />
    </div>
  );
}

function EmptyShelf({ t, locale, params }: { t: Dictionary; locale: Locale; params: CatalogParams }) {
  const c = t.catalog;
  return (
    <div className="flex flex-col items-center gap-4 border border-line bg-paper-3 px-8 py-24 text-center">
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden className="text-plum-500">
        <path d="M14 58h52" />
        <path d="M20 58V22h8v36M30 58V28h7v30M39 58V18h9v40" />
        <path d="m52 58 6-30 7 1.5-6 28.5" />
      </svg>
      <h2 className="m-0 font-serif text-[38px] font-normal">{c.emptyTitle}</h2>
      <p className="m-0 max-w-110 text-base leading-relaxed text-ink-muted">{params.q ? format(c.emptyTextQuery, { q: params.q }) : c.emptyText}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link href={`/${locale}/catalog`} className="eyebrow inline-flex h-12 items-center bg-plum-700 px-5.5 text-xs text-paper no-underline hover:bg-plum-900">
          {c.clearFilters}
        </Link>
        <Link href={`/${locale}/about#contact`} className="eyebrow inline-flex h-12 items-center border border-ink px-5.5 text-xs text-ink no-underline hover:bg-ink hover:text-paper">
          {c.suggestPurchase}
        </Link>
      </div>
    </div>
  );
}

function Pagination({ t, params, total, totalPages }: { t: Dictionary; params: CatalogParams; total: number; totalPages: number }) {
  const c = t.catalog;
  const from = (params.page - 1) * CATALOG_PAGE_SIZE + 1;
  const to = Math.min(total, params.page * CATALOG_PAGE_SIZE);
  const href = (page: number) => catalogSearch({ ...params, page }) || "?";
  // 1 2 3 … 13, with the current page and its neighbours always shown.
  const pages = [...new Set([1, params.page - 1, params.page, params.page + 1, totalPages])].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const cell = "inline-flex size-11 items-center justify-center no-underline";

  return (
    <nav aria-label={c.pagination} className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-7 sm:mt-18">
      <span className="text-sm text-ink-muted">{format(c.showing, { from: String(from), to: String(to), total: String(total) })}</span>
      {totalPages > 1 && (
        <div className="flex items-center gap-1 text-[15px]">
          {params.page > 1 ? (
            <Link href={href(params.page - 1)} aria-label={c.previous} className={`${cell} text-ink hover:bg-paper-2`}>
              <ChevronLeft aria-hidden size={18} strokeWidth={1.5} />
            </Link>
          ) : (
            <span aria-hidden className={`${cell} text-line`}>
              <ChevronLeft size={18} strokeWidth={1.5} />
            </span>
          )}
          {pages.map((p, i) => (
            <span key={p} className="contents">
              {i > 0 && p - pages[i - 1] > 1 && <span className="w-11 text-center text-ink-muted">…</span>}
              <Link
                href={href(p)}
                aria-label={format(c.page, { page: String(p) })}
                aria-current={p === params.page ? "page" : undefined}
                className={`${cell} ${p === params.page ? "bg-ink text-paper" : "text-ink hover:bg-paper-2"}`}
              >
                {p}
              </Link>
            </span>
          ))}
          {params.page < totalPages ? (
            <Link href={href(params.page + 1)} aria-label={c.next} className={`${cell} text-ink hover:bg-paper-2`}>
              <ChevronRight aria-hidden size={18} strokeWidth={1.5} />
            </Link>
          ) : (
            <span aria-hidden className={`${cell} text-line`}>
              <ChevronRight size={18} strokeWidth={1.5} />
            </span>
          )}
        </div>
      )}
    </nav>
  );
}

/** Shown while the catalog streams in (design: pulsing paper blocks). */
function CatalogSkeleton({ t, locale }: { t: Dictionary; locale: Locale }) {
  return (
    <>
      <CatalogHead t={t} locale={locale}>
        <div className="h-16 border border-line bg-paper-3 sm:h-20" />
      </CatalogHead>
      <div className="container-page grid grid-cols-2 gap-x-4.5 gap-y-8 py-10 sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] sm:gap-x-9 sm:gap-y-14 md:pl-[calc(clamp(20px,5.5vw,80px)+316px)]" aria-busy="true" aria-label={t.catalog.loading}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2.5">
            <div className="mb-2 aspect-[2/3] w-[84%] animate-pulse bg-paper-2" />
            <div className="h-5 w-4/5 animate-pulse bg-paper-2" />
            <div className="h-3.5 w-1/2 animate-pulse bg-paper-2" />
          </div>
        ))}
      </div>
    </>
  );
}
