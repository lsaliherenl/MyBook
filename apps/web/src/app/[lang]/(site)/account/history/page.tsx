import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountPageSkeleton } from "@/components/account/page-skeleton";
import Link from "next/link";
import { Download } from "lucide-react";
import type { LoanDto, ReadingYearDto } from "@mybook/shared";
import { BookCover } from "@/components/book-cover";
import type { Locale } from "@/i18n/config";
import { format, getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { api } from "@/lib/api";
import { formatNumber, formatShortDate, localized } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).history.eyebrow, robots: { index: false } };
}

/** Whole days a book was out, counting the day it was borrowed. */
const daysOut = (loan: LoanDto) => Math.max(1, Math.ceil((new Date(loan.returnedAt!).getTime() - new Date(loan.checkedOutAt).getTime()) / 86_400_000));

const EARLIER_AFTER = 10;

export default function HistoryPage(props: PageProps<"/[lang]/account/history">) {
  return (
    <Suspense fallback={<AccountPageSkeleton />}>
      <HistoryPageContent {...props} />
    </Suspense>
  );
}

async function HistoryPageContent({ searchParams }: PageProps<"/[lang]/account/history">) {
  const [t, locale, params] = await Promise.all([getDictionary(), getLocale(), searchParams]);
  const requested = Number(params.year);
  const data = await api<ReadingYearDto>(`/me/history${Number.isInteger(requested) && requested > 2000 ? `?year=${requested}` : ""}`, { auth: true });
  const h = t.history;
  const view = params.view === "covers" ? "covers" : "timeline";
  const showAll = params.all === "1";
  const query = (patch: Record<string, string | null>) => {
    const s = new URLSearchParams();
    const next = { year: String(data.year), view, all: showAll ? "1" : null, ...patch };
    for (const [k, v] of Object.entries(next)) if (v && !(k === "view" && v === "timeline")) s.set(k, v);
    return `?${s}`;
  };

  const title = data.books === 0 ? h.titleNone : data.books === 1 ? h.titleOne : h.title;
  const diff = data.books - data.previousYearBooks;
  const visible = showAll ? data.loans : data.loans.slice(0, EARLIER_AFTER);
  const months = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", { month: "long", timeZone: "Europe/Istanbul" });
  const monthLetter = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", { month: "narrow", timeZone: "UTC" });
  const best = Math.max(1, ...data.perMonth);

  // Timeline groups by month of return, newest first.
  const groups = new Map<string, LoanDto[]>();
  for (const loan of visible) {
    const key = months.format(new Date(loan.returnedAt!));
    groups.set(key, [...(groups.get(key) ?? []), loan]);
  }

  const csv = [h.csvHeader, ...data.loans.map((l) => [l.book.title, l.book.authors.map((a) => a.name).join("; "), l.checkedOutAt.slice(0, 10), l.returnedAt!.slice(0, 10), daysOut(l)].map(csvCell).join(","))].join("\r\n");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-3.5">
          <span className="eyebrow text-plum-500">{h.eyebrow}</span>
          <h1 className="m-0 font-serif text-[44px] leading-[.98] font-light md:text-[clamp(52px,5vw,76px)] md:leading-[.96]">
            {format(title, { year: String(data.year), count: String(data.books) })}
          </h1>
        </div>
        {data.years.length > 1 && (
          <div role="group" aria-label={h.year} className="inline-flex border border-ink">
            {data.years.slice(0, 4).map((y) => (
              <Link
                key={y}
                href={query({ year: String(y), all: null })}
                aria-current={y === data.year ? "true" : undefined}
                className={`inline-flex h-10 items-center px-4 text-sm no-underline ${y === data.year ? "bg-ink text-paper" : "text-ink hover:bg-paper-2"}`}
              >
                {y}
              </Link>
            ))}
          </div>
        )}
      </div>

      <section aria-label={h.yearInBooks} className="flex flex-wrap bg-plum-700 text-cream">
        <div className="grid flex-[1_1_360px] grid-cols-2 gap-px bg-cream/16">
          <Stat label={h.books} value={String(data.books)} note={format(h.vsLastYear, { diff: diff > 0 ? `+${diff}` : String(diff) })} />
          <Stat
            label={h.pages}
            value={formatNumber(data.pages, locale)}
            note={data.books ? format(h.perBook, { count: formatNumber(Math.round(data.pages / data.books), locale) }) : h.none}
          />
          <Stat
            label={h.topSubject}
            value={data.topCategory ? localized(data.topCategory, "name", locale) : h.none}
            note={data.topCategory ? format(h.ofBooks, { count: String(data.topCategory.count), total: String(data.books) }) : ""}
            small
          />
          <Stat
            label={h.topAuthor}
            value={data.topAuthor?.name ?? h.none}
            note={data.topAuthor ? format(h.authorBooks, { count: String(data.topAuthor.count) }) : ""}
            small
          />
        </div>
        <div className="flex flex-[1_1_360px] flex-col gap-4.5 border-cream/16 px-8 py-7 md:border-l">
          <span className="eyebrow text-[10px] text-[#D8C2CF]">{h.perMonth}</span>
          <div
            role="img"
            aria-label={format(h.perMonthLabel, {
              year: String(data.year),
              values: data.perMonth.map((n, i) => `${monthLetter.format(new Date(Date.UTC(2026, i, 1)))} ${n}`).join(", "),
            })}
            className="grid min-h-40 flex-1 grid-cols-12 items-end gap-2 border-b border-cream/30"
          >
            {data.perMonth.map((n, i) => (
              <div key={i} className="flex h-full flex-col items-center justify-end gap-1.5">
                <span className={`text-xs ${n === best && n > 0 ? "text-[#E6CFA3]" : "text-[#D8C2CF]"}`}>{n || ""}</span>
                <span
                  className={`w-full origin-bottom animate-grow ${n === best && n > 0 ? "bg-[#E6CFA3]" : n ? "bg-cream/72" : "bg-cream/25"}`}
                  style={{ height: n ? `${(n / best) * 120}px` : "2px", animationDelay: `${i * 0.04}s` }}
                />
              </div>
            ))}
          </div>
          <div aria-hidden className="-mt-2 grid grid-cols-12 gap-2 text-center text-[11px] text-[#D8C2CF]">
            {data.perMonth.map((_, i) => (
              <span key={i}>{monthLetter.format(new Date(Date.UTC(2026, i, 1)))}</span>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="h-shelf" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="h-shelf" className="m-0 font-serif text-[32px] font-normal md:text-[40px]">
            {h.shelf}
          </h2>
          <div className="flex items-center gap-5">
            {data.loans.length > 0 && (
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${csv}`)}`}
                download={`mybook-${data.year}.csv`}
                className="eyebrow inline-flex items-center gap-2 text-[11px] text-ink no-underline hover:text-plum-500"
              >
                <Download aria-hidden size={16} strokeWidth={1.5} />
                {h.exportCsv}
              </a>
            )}
            <div role="group" aria-label={h.view} className="inline-flex border border-line">
              {(["timeline", "covers"] as const).map((v) => (
                <Link
                  key={v}
                  href={query({ view: v })}
                  scroll={false}
                  aria-current={view === v ? "true" : undefined}
                  className={`inline-flex h-10 items-center px-3.5 text-sm no-underline ${view === v ? "bg-ink text-paper" : "text-ink hover:bg-paper-2"}`}
                >
                  {v === "timeline" ? h.timeline : h.covers}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {data.loans.length === 0 ? (
          <p className="m-0 text-ink-muted">{h.empty}</p>
        ) : view === "timeline" ? (
          <div key="timeline" className="flex animate-swap flex-col gap-9">
            {[...groups.entries()].map(([month, loans]) => (
              <div key={month} className="grid grid-cols-1 gap-3 md:grid-cols-[140px_minmax(0,1fr)] md:gap-6">
                <div className="flex items-baseline gap-3 md:flex-col md:gap-1 md:pt-4.5">
                  <span className="font-serif text-[28px] leading-none capitalize">{month}</span>
                  <span className="text-[13px] text-ink-muted">{loans.length === 1 ? h.monthBooksOne : format(h.monthBooks, { count: String(loans.length) })}</span>
                </div>
                <ol className="m-0 list-none border-l border-line p-0">
                  {loans.map((loan) => (
                    <TimelineRow key={loan.id} loan={loan} t={t} locale={locale} />
                  ))}
                </ol>
              </div>
            ))}
            {!showAll && data.loans.length > EARLIER_AFTER && (
              <Link
                href={query({ all: "1" })}
                scroll={false}
                className="eyebrow inline-flex h-12 items-center self-center border border-ink px-6 text-[11px] text-ink no-underline hover:bg-ink hover:text-paper"
              >
                {format(h.showEarlier, { count: String(data.loans.length - EARLIER_AFTER) })}
              </Link>
            )}
          </div>
        ) : (
          <div key="covers" className="grid animate-swap grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-x-6 gap-y-9">
            {data.loans.map((loan) => (
              <Link key={loan.id} href={`/${locale}/books/${loan.book.slug}`} className="flex flex-col gap-1 text-ink no-underline">
                <BookCover book={loan.book} sizes="150px" className="cover-lift mb-3 w-full" />
                <span lang={loan.book.language} className="font-serif text-lg leading-[1.15]">
                  {loan.book.title}
                </span>
                <span className="text-xs text-ink-muted">{format(h.returned, { date: formatShortDate(loan.returnedAt!, locale) })}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function csvCell(value: string | number) {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function Stat({ label, value, note, small }: { label: string; value: string; note: string; small?: boolean }) {
  return (
    <div className="flex flex-col gap-2 bg-plum-700 p-7">
      <span className="eyebrow text-[10px] text-[#D8C2CF]">{label}</span>
      <span className={`font-serif leading-[1.05] ${small ? "text-[28px] md:text-[34px]" : "text-[48px] leading-none md:text-[56px]"}`}>{value}</span>
      <span className="text-[13px] text-[#D8C2CF]">{note}</span>
    </div>
  );
}

function TimelineRow({ loan, t, locale }: { loan: LoanDto; t: Dictionary; locale: Locale }) {
  const h = t.history;
  const details = [
    format(h.days, { days: String(daysOut(loan)) }),
    loan.renewCount > 0 && h.renewed,
    loan.daysOverdue > 0 && format(h.late, { days: String(loan.daysOverdue) }),
  ].filter(Boolean);
  return (
    <li className="relative flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line py-3.5 pl-7">
      <span aria-hidden className="absolute top-1/2 -left-1 -mt-0.75 size-1.75 rounded-full bg-plum-500" />
      <span className="w-16 text-[13px] text-ink-muted">{formatShortDate(loan.returnedAt!, locale)}</span>
      <Link href={`/${locale}/books/${loan.book.slug}`} className="flex-none">
        <BookCover book={loan.book} sizes="40px" className="w-10" />
      </Link>
      <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
        <span lang={loan.book.language} className="font-serif text-[22px] leading-[1.1]">
          {loan.book.title}
        </span>
        <span className="text-sm text-ink-muted">{loan.book.authors.map((a) => a.name).join(", ")}</span>
      </span>
      <span className="w-30 text-[13px] text-ink-muted">{details.join(" · ")}</span>
      <Link href={`/${locale}/books/${loan.book.slug}`} className="eyebrow text-[10.5px] text-ink no-underline hover:text-plum-500">
        {h.borrowAgain}
      </Link>
    </li>
  );
}
