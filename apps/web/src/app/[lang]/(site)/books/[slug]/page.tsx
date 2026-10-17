import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Heart, MapPin } from "lucide-react";
import { FAVORITES_LIST_ID, type BookDetailDto, type BookSummaryDto, type LibrarySettingsDto, type ReadingListDto, type RelatedBooksDto } from "@mybook/shared";
import { ActionButton } from "@/components/action-button";
import { AddToBagButton } from "@/components/bag/add-to-bag-button";
import { AvailabilityText, ShelfCard } from "@/components/book-card";
import { BookCover } from "@/components/book-cover";
import { SaveToListMenu } from "@/components/lists/list-controls";
import { ArrowLink } from "@/components/section-heading";
import type { Locale } from "@/i18n/config";
import { format, getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { api } from "@/lib/api";
import { readBag } from "@/lib/bag";
import { getBook, getRules } from "@/lib/catalog";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { formatDay, formatShortDate, formatTime, languageName, localized } from "@/lib/format";
import { getMemberCirculation, type MemberCirculation } from "@/lib/member";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { renewLoan, reserveBook } from "../../circulation-actions";

export async function generateMetadata({ params }: PageProps<"/[lang]/books/[slug]">): Promise<Metadata> {
  const book = await getBook((await params).slug);
  if (!book) return {};
  return {
    title: book.title,
    description: book.description?.slice(0, 160) ?? undefined,
    openGraph: book.coverUrl ? { images: [{ url: book.coverUrl }] } : undefined,
  };
}

export default async function BookPage({ params }: PageProps<"/[lang]/books/[slug]">) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <BookView params={params} />
    </Suspense>
  );
}

async function BookView({ params }: { params: PageProps<"/[lang]/books/[slug]">["params"] }) {
  const { slug } = await params;
  const [t, locale, book] = await Promise.all([getDictionary(), getLocale(), getBook(slug)]);
  if (!book) notFound();
  const b = t.bookPage;
  const category = book.categories[0];
  const factsShelf = book.shelfLocations.join(", ");

  return (
    <>
      <div className="container-page pt-5 sm:pt-7">
        <nav aria-label={t.catalog.breadcrumb} className="flex flex-wrap gap-3 text-sm">
          <Link href={`/${locale}/catalog`} className="text-ink-muted no-underline hover:text-plum-500">
            {t.nav.catalog}
          </Link>
          {category && (
            <>
              <span aria-hidden className="text-line">
                /
              </span>
              <Link href={`/${locale}/catalog?category=${category.slug}`} className="text-ink-muted no-underline hover:text-plum-500">
                {localized(category, "name", locale)}
              </Link>
            </>
          )}
          <span aria-hidden className="text-line">
            /
          </span>
          <span aria-current="page" lang={book.language} className="min-w-0 truncate">
            {book.title}
          </span>
        </nav>
      </div>

      <div className="container-page flex flex-wrap items-start gap-10 pt-6 pb-20 sm:pt-8 lg:gap-18 lg:pb-26">
        <div className="flex w-full flex-col items-center bg-paper-2 px-10 pt-12 pb-11 sm:px-10 sm:pt-18 sm:pb-16 lg:max-w-130 lg:flex-[1_1_420px]">
          <BookCover
            book={book}
            sizes="(max-width: 640px) 70vw, 320px"
            priority
            className="w-[min(320px,78%)] shadow-[0_2px_4px_rgba(35,26,31,.2),0_40px_60px_-24px_rgba(35,26,31,.55)] sm:w-[min(320px,100%)]"
          />
        </div>

        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-5.5">
          {book.categories.length > 0 && (
            <span className="eyebrow text-plum-500">{book.categories.map((c) => localized(c, "name", locale)).join(" · ")}</span>
          )}
          <h1 lang={book.language} className="m-0 font-serif text-[44px] leading-[.98] font-light [hyphens:auto] sm:text-[clamp(52px,5.4vw,80px)]">
            {book.title}
          </h1>
          <p className="m-0 text-lg">
            {book.authors.map((a, i) => (
              <span key={a.slug}>
                {i > 0 && ", "}
                <Link href={`/${locale}/catalog?author=${a.slug}`} className="text-ink underline decoration-line underline-offset-5 hover:text-plum-500 hover:decoration-plum-500">
                  {a.name}
                </Link>
              </span>
            ))}
            {book.publishedYear && <span className="text-ink-muted"> · {format(b.firstPublished, { year: String(book.publishedYear) })}</span>}
          </p>
          {book.categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {book.categories.map((c) => {
                const Icon = CATEGORY_ICONS[c.slug]?.[0];
                return (
                  <Link
                    key={c.slug}
                    href={`/${locale}/catalog?category=${c.slug}`}
                    className="group inline-flex items-center border border-line px-3 py-1.5 text-[13px] text-ink no-underline hover:border-plum-500 hover:text-plum-700"
                  >
                    {Icon && (
                      <span className="inline-flex max-w-0 overflow-hidden text-plum-500 transition-[max-width,margin] duration-350 ease-out-soft group-hover:mr-2 group-hover:max-w-6">
                        <Icon aria-hidden size={14} strokeWidth={1.5} />
                      </span>
                    )}
                    {localized(c, "name", locale)}
                  </Link>
                );
              })}
            </div>
          )}

          <section aria-label={b.availability} className="mt-3 border border-line bg-paper-3">
            <Suspense fallback={<div className="h-64 animate-pulse bg-paper-3" />}>
              <AvailabilityBox book={book} t={t} locale={locale} />
            </Suspense>
          </section>

          <Suspense fallback={<div className="h-11" />}>
            <SaveToList book={book} t={t} locale={locale} />
          </Suspense>

          <div className="mt-5 flex flex-col gap-4 border-t border-line pt-8">
            <h2 className="m-0 font-serif text-[32px] font-normal">{b.about}</h2>
            {book.description ? (
              book.description
                .split(/\n+/)
                .filter((p) => p.trim())
                .map((p, i) => (
                  <p key={i} lang={book.language} className="m-0 max-w-160 text-[17px] leading-[1.7] font-light">
                    {p}
                  </p>
                ))
            ) : (
              <p className="m-0 text-ink-muted">{b.noDescription}</p>
            )}
          </div>

          <dl className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-10 text-[15px]">
            {[
              [b.publisher, book.publisher],
              [b.edition, book.publishedYear],
              [b.pages, book.pageCount],
              [b.language, languageName(book.language, locale)],
              [b.isbn, book.isbn13 ? formatIsbn(book.isbn13) : book.isbn10],
              [b.shelfLabel, factsShelf],
            ]
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={String(label)} className="flex justify-between gap-4 border-b border-line py-3">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="m-0 text-right tabular-nums">{value}</dd>
                </div>
              ))}
          </dl>
        </div>
      </div>

      <Suspense>
        <Related slug={book.slug} book={book} t={t} locale={locale} />
      </Suspense>
    </>
  );
}

/** "Save to a list" for members; visitors get a link to sign in. */
async function SaveToList({ book, t, locale }: { book: BookDetailDto; t: Dictionary; locale: Locale }) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    return (
      <Link
        href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/books/${book.slug}`)}`}
        className="group inline-flex h-11 items-center gap-2.5 self-start text-[15px] text-ink no-underline hover:text-plum-500"
      >
        <Heart aria-hidden size={20} strokeWidth={1.5} className="group-hover:animate-icon-beat" />
        {t.lists.signInToSave}
      </Link>
    );
  }
  const [lists, containing] = await Promise.all([
    api<ReadingListDto[]>("/me/lists", { auth: true }).catch(() => []),
    api<string[]>(`/me/lists/containing/${book.id}`, { auth: true }).catch(() => []),
  ]);
  return (
    <SaveToListMenu
      bookId={book.id}
      lists={lists.map((l) => ({ id: l.id, name: l.id === FAVORITES_LIST_ID ? t.lists.favorites : l.name }))}
      initial={containing}
      labels={t.lists}
      manageHref={`/${locale}/account/lists`}
    />
  );
}

const formatIsbn = (isbn: string) => `${isbn.slice(0, 3)}-${isbn.slice(3, 4)}-${isbn.slice(4, 8)}-${isbn.slice(8, 12)}-${isbn.slice(12)}`;

/** The part of the page that depends on who is looking: on loan to you, held for you, in the queue, or free to reserve. */
async function AvailabilityBox({ book, t, locale }: { book: BookDetailDto; t: Dictionary; locale: Locale }) {
  const [member, rules, bag] = await Promise.all([getMemberCirculation(), getRules(), readBag()]);
  const b = t.bookPage;
  const back = `/${locale}/books/${book.slug}`;
  const loan = member?.activeLoans.find((l) => l.book.id === book.id);
  const reservation = member?.openReservations.find((r) => r.book.id === book.id);
  const a = book.availability;
  const primary = "eyebrow inline-flex h-14 items-center justify-center gap-3 bg-plum-700 px-7 text-xs text-paper no-underline hover:bg-plum-900";
  const secondary = "eyebrow inline-flex h-14 items-center justify-center border border-ink px-7 text-xs text-ink no-underline hover:bg-ink hover:text-paper";
  const badge = (tone: string, text: string, dot = false) => (
    <span className={`eyebrow inline-flex items-center gap-2 self-start rounded-xs px-2.5 py-1.5 ${tone}`}>
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {text}
    </span>
  );

  if (loan) {
    const total = rules.loanDays * (loan.renewCount + 1);
    const left = loan.daysLeft;
    const renewalsLeft = rules.maxRenewals - loan.renewCount;
    return (
      <div className="flex animate-swap flex-col gap-4.5 p-7">
        {badge(loan.daysOverdue ? "bg-overdue-bg text-overdue" : "bg-loan-bg text-loan", loan.daysOverdue ? format(b.overdueBy, { days: String(loan.daysOverdue) }) : b.yourLoan)}
        <span className="font-serif text-[32px] leading-[1.1]">{format(b.dueBack, { date: formatDay(loan.dueAt, locale) })}</span>
        <div className="flex flex-col gap-2">
          <div className="flex h-1 bg-line">
            <div className="bg-plum-700" style={{ width: `${Math.min(100, ((total - left) / total) * 100)}%` }} />
          </div>
          <span className="text-sm text-ink-muted">
            {format(b.daysLeft, { left: String(left), total: String(total), date: formatShortDate(loan.checkedOutAt, locale) })}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {loan.canRenew && (
            <ActionButton
              action={renewLoan}
              fields={{ loanId: loan.id }}
              label={format(b.renew, { days: String(rules.loanDays) })}
              errors={t.circulationErrors}
              success={b.renewed}
              locale={locale}
              className={secondary}
            />
          )}
          <span className="text-[13px] text-ink-muted">
            {renewalsLeft > 0 ? format(b.renewalsLeft, { count: String(renewalsLeft) }) : b.noRenewals} ·{" "}
            {a.waiting > 0 ? b.someoneWaiting : b.nobodyWaitingShort}
          </span>
        </div>
      </div>
    );
  }

  if (reservation?.status === "READY") {
    return (
      <div className="flex animate-swap flex-col gap-4.5 p-7">
        {badge("bg-ready-bg text-ready", b.yourHold, true)}
        <span className="font-serif text-[32px] leading-[1.1]">
          {reservation.expiresAt && format(b.pickupBy, { date: formatDay(reservation.expiresAt, locale), time: formatTime(reservation.expiresAt, locale) })}
        </span>
        <span className="flex items-center gap-3 text-sm text-ink-muted">
          {b.pickupCode}
          <span className="font-serif text-2xl tracking-widest text-ink">{reservation.code}</span>
        </span>
        <Link href={`/${locale}/account/loans`} className={`${secondary} self-start`}>
          {b.manageReservations}
        </Link>
      </div>
    );
  }

  if (reservation) {
    return (
      <div className="flex animate-swap flex-col gap-4.5 p-7">
        {badge("bg-loan-bg text-loan", b.inQueue)}
        <span className="font-serif text-[32px] leading-[1.1]">{format(b.queuePosition, { n: String(reservation.queuePosition ?? 1) })}</span>
        {a.nextDueAt && <span className="text-sm text-ink-muted">{format(b.nextBack, { date: formatShortDate(a.nextDueAt, locale) })}</span>}
        <Link href={`/${locale}/account/loans`} className={`${secondary} self-start`}>
          {b.manageReservations}
        </Link>
      </div>
    );
  }

  const bagButton = (
    <AddToBagButton
      bookId={book.id}
      inBag={bag.includes(book.id)}
      label={b.addToBag}
      inBagLabel={b.inBag}
      fullLabel={t.catalog.bagFull}
      className={primary}
    />
  );
  const reserveFields = { bookId: book.id, lang: locale, back };

  if (a.available > 0) {
    const shelf = book.copies.find((c) => c.status === "AVAILABLE")?.shelfLocation;
    return (
      <div className="flex animate-swap flex-col gap-4.5 p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {badge("bg-available-bg text-available", b.available, true)}
          {shelf && (
            <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
              <MapPin aria-hidden size={16} strokeWidth={1.5} />
              {format(b.shelf, { shelf })}
            </span>
          )}
        </div>
        <span className="font-serif text-[32px] leading-[1.1]">
          {a.total === 1 ? b.copyAvailableOne : format(b.copiesAvailable, { available: String(a.available), total: String(a.total) })}
        </span>
        <CopyList book={book} t={t} locale={locale} />
        <div className="mt-1 flex flex-wrap gap-3">
          {bagButton}
          <ActionButton action={reserveBook} fields={reserveFields} label={b.reserveNow} errors={t.circulationErrors} className={secondary} />
        </div>
        <span className="text-[13px] leading-normal text-ink-muted">
          {format(b.terms, { hours: String(rules.pickupWindowHours), days: String(rules.loanDays) })}
          {member?.standing && ` · ${format(b.slotsFree, slotValues(member, rules))}`}
        </span>
      </div>
    );
  }

  if (a.total === 0) {
    return (
      <div className="flex flex-col gap-4 p-7">
        {badge("bg-stone-bg text-stone", t.book.noCopies)}
        <span className="font-serif text-[28px] leading-[1.1]">{b.noCopies}</span>
      </div>
    );
  }

  const ahead = a.waiting;
  return (
    <div className="flex animate-swap flex-col gap-4.5 p-7">
      {badge("bg-loan-bg text-loan", b.allOnLoan)}
      {a.nextDueAt && <span className="font-serif text-[32px] leading-[1.1]">{format(b.nextBack, { date: formatShortDate(a.nextDueAt, locale) })}</span>}
      <div className="flex items-center gap-2.5">
        {Array.from({ length: Math.min(ahead, 4) }, (_, i) => (
          <span key={i} className="inline-flex size-8 items-center justify-center rounded-full bg-line text-xs">
            {i + 1}
          </span>
        ))}
        {ahead > 4 && <span className="text-xs text-ink-muted">…</span>}
        <span className="inline-flex size-8 items-center justify-center rounded-full border border-dashed border-plum-500 text-xs text-plum-500">{b.you}</span>
        <span className="ml-1.5 text-sm text-ink-muted">
          {ahead === 0 ? b.nobodyWaiting : ahead === 1 ? b.aheadOne : format(b.aheadOfYou, { count: String(ahead) })}
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        <ActionButton action={reserveBook} fields={reserveFields} label={format(b.joinWaitlist, { n: String(ahead + 1) })} errors={t.circulationErrors} className={primary} />
      </div>
      <span className="text-[13px] leading-normal text-ink-muted">{format(b.waitlistNote, { hours: String(rules.pickupWindowHours) })}</span>
    </div>
  );
}

function slotValues(member: MemberCirculation, rules: LibrarySettingsDto) {
  const s = member.standing!;
  return { free: String(Math.max(0, s.maxActiveLoans - s.activeLoans - s.openReservations)), max: String(s.maxActiveLoans ?? rules.maxActiveLoans) };
}

function CopyList({ book, t, locale }: { book: BookDetailDto; t: Dictionary; locale: Locale }) {
  const b = t.bookPage;
  return (
    <ul className="m-0 flex list-none flex-col border-t border-line p-0 text-sm">
      {book.copies.map((copy, i) => (
        <li key={i} className="flex justify-between gap-4 border-b border-line py-2.5">
          <span>
            {format(b.copy, { n: String(i + 1).padStart(2, "0") })}
            {copy.shelfLocation && <span className="text-ink-muted"> · {copy.shelfLocation}</span>}
          </span>
          {copy.status === "ON_LOAN" && copy.dueAt ? (
            <span className="text-loan">{format(b.dueOn, { date: formatShortDate(copy.dueAt, locale) })}</span>
          ) : (
            <span className={copy.status === "AVAILABLE" ? "text-available" : copy.status === "ON_HOLD" ? "text-ready" : "text-ink-muted"}>
              {b.copyStatus[copy.status]}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

async function Related({ slug, book, t, locale }: { slug: string; book: BookDetailDto; t: Dictionary; locale: Locale }) {
  const related = await api<RelatedBooksDto>(`/books/${encodeURIComponent(slug)}/related`).catch(() => null);
  if (!related) return null;
  const author = book.authors[0];
  return (
    <>
      {related.moreByAuthor.length > 0 && author && (
        <section aria-labelledby="h-more" className="bg-paper-2 py-16 sm:py-22">
          <div className="container-page">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-10">
              <h2 id="h-more" className="m-0 font-serif text-[30px] font-normal sm:text-[40px]">
                {format(t.bookPage.moreBy, { author: author.name })}
              </h2>
              <ArrowLink href={`/${locale}/catalog?author=${author.slug}`} label={t.bookPage.allBooks} />
            </div>
            <Shelf books={related.moreByAuthor} t={t} locale={locale} withStatus />
          </div>
        </section>
      )}
      {related.alsoBorrowed.length > 0 && (
        <section aria-labelledby="h-also" className="pt-16 pb-20 sm:pt-22 sm:pb-28">
          <div className="container-page">
            <h2 id="h-also" className="m-0 mb-8 font-serif text-[30px] font-normal sm:mb-10 sm:text-[40px]">
              {t.bookPage.alsoBorrowed}
            </h2>
            <Shelf books={related.alsoBorrowed} t={t} locale={locale} />
          </div>
        </section>
      )}
    </>
  );
}

function Shelf({ books, t, locale, withStatus }: { books: BookSummaryDto[]; t: Dictionary; locale: Locale; withStatus?: boolean }) {
  return (
    <div className="shelf-scroll -mr-5 flex gap-5 overflow-x-auto pr-5 pb-3.5 sm:mr-0 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] sm:gap-x-8 sm:gap-y-10 sm:overflow-visible sm:pr-0 sm:pb-0">
      {books.map((book) => (
        <div key={book.id} className="flex w-37.5 flex-none flex-col sm:w-auto">
          <ShelfCard book={book} locale={locale} />
          {withStatus && <AvailabilityText book={book} t={t.book} locale={locale} className="mt-1 text-[10px]" />}
        </div>
      ))}
    </div>
  );
}
