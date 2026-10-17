import Link from "next/link";
import type { AvailabilityDto, BookSummaryDto } from "@mybook/shared";
import type { Locale } from "@/i18n/config";
import { format, type Dictionary } from "@/i18n/get-dictionary";
import { formatShortDate } from "@/lib/format";
import { BookCover } from "./book-cover";

export type Tone = "available" | "loan" | "ready" | "muted";

const TONE_TEXT: Record<Tone, string> = {
  available: "text-available",
  loan: "text-loan",
  ready: "text-ready",
  muted: "text-ink-muted",
};

const TONE_BADGE: Record<Tone, string> = {
  available: "bg-available-bg text-available",
  loan: "bg-loan-bg text-loan",
  ready: "bg-ready-bg text-ready",
  muted: "bg-stone-bg text-stone",
};

/** "Available", "1 of 4 available", "On loan · due Nov 3", "On loan · 4 waiting"… with the matching status colour. */
export function availabilityLabel(a: AvailabilityDto, t: Dictionary["book"], locale: Locale): { text: string; tone: Tone } {
  if (a.total === 0) return { text: t.noCopies, tone: "muted" };
  if (a.available > 0 && a.available === a.total) return { text: t.available, tone: "available" };
  if (a.available > 0) return { text: format(t.someAvailable, { available: String(a.available), total: String(a.total) }), tone: "available" };
  if (a.waiting > 0) return { text: format(t.onLoanWaiting, { count: String(a.waiting) }), tone: "loan" };
  if (a.nextDueAt) return { text: format(t.onLoanDue, { date: formatShortDate(a.nextDueAt, locale) }), tone: "loan" };
  if (a.onLoan === 0 && a.onHold > 0) return { text: t.onHold, tone: "ready" };
  return { text: t.onLoan, tone: "loan" };
}

export function AvailabilityText({ book, t, locale, className = "" }: { book: BookSummaryDto; t: Dictionary["book"]; locale: Locale; className?: string }) {
  const { text, tone } = availabilityLabel(book.availability, t, locale);
  return <span className={`eyebrow ${TONE_TEXT[tone]} ${className}`}>{text}</span>;
}

/** The same label as a small tinted badge (catalog grid and list). */
export function AvailabilityBadge({ book, t, locale, className = "" }: { book: BookSummaryDto; t: Dictionary["book"]; locale: Locale; className?: string }) {
  const { text, tone } = availabilityLabel(book.availability, t, locale);
  return <span className={`eyebrow rounded-xs px-2 py-1.25 text-[10px] ${TONE_BADGE[tone]} ${className}`}>{text}</span>;
}

export const bookHref = (locale: Locale, slug: string) => `/${locale}/books/${slug}`;

const authorNames = (book: BookSummaryDto) => book.authors.map((a) => a.name).join(", ");
const categoryName = (book: BookSummaryDto, locale: Locale) => {
  const c = book.categories[0];
  return c ? (locale === "tr" ? c.nameTr : c.nameEn) : null;
};

/** Large card: cover, title, author, category · availability (home "Librarian's picks", catalog grid). */
export function BookCard({ book, locale, t, priority }: { book: BookSummaryDto; locale: Locale; t: Dictionary["book"]; priority?: boolean }) {
  const category = categoryName(book, locale);
  return (
    <Link href={bookHref(locale, book.slug)} className="flex w-39 shrink-0 flex-col gap-1 text-ink no-underline sm:w-auto sm:gap-1.5">
      <BookCover
        book={book}
        sizes="(max-width: 640px) 156px, 220px"
        priority={priority}
        className="cover-lift mb-4 w-full sm:mb-5.5 sm:w-[78%] sm:max-w-55"
      />
      <span lang={book.language} className="font-serif text-xl leading-tight sm:text-[25px]">
        {book.title}
      </span>
      <span className="text-sm text-ink-muted sm:text-[15px]">{authorNames(book)}</span>
      <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 sm:mt-2.5">
        {category && <span className="eyebrow text-[10px] text-ink-muted sm:text-[11px]">{category}</span>}
        {category && <span aria-hidden className="size-0.75 rounded-full bg-ink-muted" />}
        <AvailabilityText book={book} t={t} locale={locale} className="text-[10px] sm:text-[11px]" />
      </span>
    </Link>
  );
}

/** Small shelf card: cover, title, author (home "New arrivals", "More by the author"). */
export function ShelfCard({ book, locale }: { book: BookSummaryDto; locale: Locale }) {
  return (
    <Link href={bookHref(locale, book.slug)} className="flex w-28 shrink-0 flex-col gap-0.75 text-ink no-underline sm:w-auto sm:gap-1">
      <BookCover book={book} sizes="(max-width: 640px) 112px, 180px" className="cover-lift mb-3 w-full sm:mb-4" />
      <span lang={book.language} className="font-serif text-[17px] leading-tight sm:text-xl">
        {book.title}
      </span>
      <span className="text-[13px] text-ink-muted sm:text-sm">{authorNames(book)}</span>
    </Link>
  );
}

/** Ranked card with the big italic number (home "Most borrowed this month"). */
export function RankedCard({ book, rank, locale, t }: { book: BookSummaryDto; rank: number; locale: Locale; t: Dictionary["book"] }) {
  return (
    <Link
      href={bookHref(locale, book.slug)}
      className="flex h-full flex-col gap-1.5 border border-line bg-paper-3 px-4 py-3.5 text-ink no-underline sm:border-0 sm:bg-transparent sm:p-0"
    >
      <span className="mb-4 font-serif text-[64px] leading-none font-light text-plum-500 italic">{String(rank).padStart(2, "0")}</span>
      <BookCover book={book} sizes="140px" className="cover-lift mb-4.5 w-35" />
      <span lang={book.language} className="font-serif text-[21px] leading-tight">
        {book.title}
      </span>
      <span className="text-sm text-ink-muted">{authorNames(book)}</span>
      <AvailabilityText book={book} t={t} locale={locale} className="mt-2" />
    </Link>
  );
}

/** Catalog grid card: cover, title, "author · year" and an availability badge. */
export function CatalogCard({ book, locale, t, priority }: { book: BookSummaryDto; locale: Locale; t: Dictionary["book"]; priority?: boolean }) {
  return (
    <Link href={bookHref(locale, book.slug)} className="flex flex-col gap-1.25 text-ink no-underline">
      <BookCover book={book} sizes="(max-width: 760px) 45vw, 200px" priority={priority} className="cover-lift mb-4.5 w-[84%]" />
      <span lang={book.language} className="font-serif text-[19px] leading-tight sm:text-[22px]">
        {book.title}
      </span>
      <span className="text-[13px] text-ink-muted sm:text-sm">
        {authorNames(book)}
        {book.publishedYear && ` · ${book.publishedYear}`}
      </span>
      <AvailabilityBadge book={book} t={t} locale={locale} className="mt-2.5 self-start" />
    </Link>
  );
}
