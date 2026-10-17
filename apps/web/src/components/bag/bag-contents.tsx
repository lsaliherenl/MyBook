import Link from "next/link";
import { X } from "lucide-react";
import type { BookSummaryDto, MemberStandingDto, Paginated } from "@mybook/shared";
import { removeFromBag } from "@/app/[lang]/(site)/bag-actions";
import { format, getDictionary, getLocale } from "@/i18n/get-dictionary";
import { api } from "@/lib/api";
import { readBag } from "@/lib/bag";
import { getRules } from "@/lib/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AvailabilityText } from "../book-card";
import { BookCover } from "../book-cover";
import { CloseBagButton } from "./bag-drawer";
import { ReserveBagForm } from "./reserve-bag-form";

export const BAG_HEADING_ID = "bag-heading";

/** Drawer body: the books in the bag, how they fit the member's loan limit, and "Reserve all". */
export async function BagContents() {
  const [t, locale, ids, rules] = await Promise.all([getDictionary(), getLocale(), readBag(), getRules()]);
  const books = ids.length
    ? ((await api<Paginated<BookSummaryDto>>(`/books?ids=${ids.join(",")}&pageSize=${ids.length}`).catch(() => null))?.items ?? [])
    : [];
  // Keep the order in which books were added.
  books.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const standing = signedIn ? await api<MemberStandingDto>("/me/standing", { auth: true }).catch(() => null) : null;

  const count = books.length;
  const heading = count === 1 ? t.bag.countOne : format(t.bag.count, { count: String(count) });

  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-line px-7 pt-7 pb-4.5">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow text-[10px] text-plum-500">{t.bag.title}</span>
          <h2 id={BAG_HEADING_ID} className="m-0 font-serif text-[34px] leading-none font-normal">
            {count ? heading : t.bag.empty}
          </h2>
        </div>
        <CloseBagButton label={t.bag.close} className="-mt-2 -mr-2.5 inline-flex size-11 items-center justify-center hover:text-plum-500" />
      </div>

      {count === 0 ? (
        <div className="flex flex-1 flex-col items-start gap-6 px-7 py-8">
          <p className="m-0 max-w-80 text-base leading-relaxed text-ink-muted">{t.bag.emptyText}</p>
          <Link href={`/${locale}/catalog`} className="eyebrow inline-flex h-12 items-center bg-plum-700 px-6 text-paper no-underline hover:bg-plum-900">
            {t.bag.browse}
          </Link>
        </div>
      ) : (
        <>
          <ul className="m-0 flex-1 list-none overflow-y-auto px-7 py-1">
            {books.map((book, i) => (
              <li
                key={book.id}
                className="flex animate-swap items-start gap-4 border-b border-line py-4.5"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <Link href={`/${locale}/books/${book.slug}`} className="flex-none">
                  <BookCover book={book} sizes="60px" className="w-15" />
                </Link>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link href={`/${locale}/books/${book.slug}`} lang={book.language} className="font-serif text-[21px] leading-[1.1] text-ink no-underline hover:text-plum-500">
                    {book.title}
                  </Link>
                  <span className="text-[13px] text-ink-muted">{book.authors.map((a) => a.name).join(", ")}</span>
                  <AvailabilityText book={book} t={t.book} locale={locale} className="mt-1 text-[9.5px]" />
                </span>
                <form action={removeFromBag.bind(null, book.id)}>
                  <button type="submit" aria-label={`${t.bag.remove}: ${book.title}`} className="-mr-2 inline-flex size-9 items-center justify-center text-ink-muted hover:text-plum-500">
                    <X aria-hidden size={16} strokeWidth={1.5} />
                  </button>
                </form>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3.5 border-t border-line bg-paper-2 px-7 pt-5 pb-7">
            {standing && <SlotMeter standing={standing} bagCount={count} t={t.bag} />}
            <span className="text-[13px] text-ink-muted">
              {format(t.bag.terms, { hours: String(rules.pickupWindowHours), days: String(rules.loanDays) })}
            </span>
            {signedIn ? (
              <ReserveBagForm locale={locale} label={format(t.bag.reserveAll, { count: heading })} errors={t.circulationErrors} />
            ) : (
              <Link
                href={`/${locale}/login?next=${encodeURIComponent(`/${locale}`)}`}
                className="eyebrow flex h-13.5 items-center justify-center bg-plum-700 text-paper no-underline hover:bg-plum-900"
              >
                {t.bag.signInToReserve}
              </Link>
            )}
            <CloseBagButton className="eyebrow flex h-11.5 items-center justify-center border border-ink hover:bg-paper">{t.bag.keepBrowsing}</CloseBagButton>
          </div>
        </>
      )}
    </>
  );
}

/** Five little bars: loans and open reservations in plum, the bag in gold (red past the limit). */
function SlotMeter({ standing, bagCount, t }: { standing: MemberStandingDto; bagCount: number; t: { slots: string; slotsLeft: string; slotsLast: string; slotsOver: string } }) {
  const used = standing.activeLoans + standing.openReservations;
  const max = standing.maxActiveLoans;
  const left = max - used - bagCount;
  const summary =
    left < 0 ? format(t.slotsOver, { count: String(-left) }) : left === 0 ? format(t.slotsLast, { count: String(bagCount) }) : format(t.slotsLeft, { count: String(left) });
  return (
    <>
      <div className="flex justify-between text-sm">
        <span>{t.slots}</span>
        <span className={`font-medium ${left < 0 ? "text-overdue" : ""}`}>{summary}</span>
      </div>
      <div aria-hidden className="grid gap-1" style={{ gridTemplateColumns: `repeat(${max}, 1fr)` }}>
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={`h-1 ${i < used ? "bg-plum-700" : i < used + bagCount ? (left < 0 ? "bg-overdue" : "bg-gold") : "bg-line"}`} />
        ))}
      </div>
    </>
  );
}
