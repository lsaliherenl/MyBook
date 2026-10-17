import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountPageSkeleton } from "@/components/account/page-skeleton";
import Link from "next/link";
import type { FineDto, LibrarySettingsDto, LoanDto, ReservationDto } from "@mybook/shared";
import { ActionButton } from "@/components/action-button";
import { groupReservations, type ReservationGroup } from "@/components/account/reservation-row";
import { BookCover } from "@/components/book-cover";
import type { Locale } from "@/i18n/config";
import { format, getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { api } from "@/lib/api";
import { getRules } from "@/lib/catalog";
import { formatDay, formatMoney, formatShortDate, formatTime } from "@/lib/format";
import { getMemberCirculation } from "@/lib/member";
import { cancelReservation, renewAll, renewLoan } from "../../circulation-actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).loansPage.title, robots: { index: false } };
}

const TABS = ["loans", "reservations", "waitlist", "fines"] as const;
type Tab = (typeof TABS)[number];

export default function LoansPage(props: PageProps<"/[lang]/account/loans">) {
  return (
    <Suspense fallback={<AccountPageSkeleton />}>
      <LoansPageContent {...props} />
    </Suspense>
  );
}

async function LoansPageContent({ searchParams }: PageProps<"/[lang]/account/loans">) {
  const [t, locale, params] = await Promise.all([getDictionary(), getLocale(), searchParams]);
  const tab: Tab = TABS.find((x) => x === params.tab) ?? "loans";
  const [circulation, reservations, fines, rules] = await Promise.all([
    getMemberCirculation(),
    api<ReservationDto[]>("/me/reservations", { auth: true }).catch(() => []),
    api<FineDto[]>("/me/fines", { auth: true }).catch(() => []),
    getRules(),
  ]);
  const p = t.loansPage;
  const loans = [...(circulation?.activeLoans ?? [])].sort((a, b) => b.daysOverdue - a.daysOverdue || a.dueAt.localeCompare(b.dueAt));
  const queue = reservations.filter((r) => r.status === "PENDING");
  const groups = groupReservations(reservations.filter((r) => r.status !== "PENDING"));
  const ready = reservations.filter((r) => r.status === "READY").length;
  const standing = circulation?.standing;
  const accruing = loans.filter((l) => l.daysOverdue > 0).reduce((s, l) => s + l.fineAmount, 0);
  const balance = accruing + fines.filter((f) => f.status === "UNPAID").reduce((s, f) => s + f.amount, 0);
  const max = standing?.maxActiveLoans ?? rules.maxActiveLoans;

  const summary = [
    format(p.summarySlots, { used: String((standing?.activeLoans ?? loans.length) + (standing?.openReservations ?? 0)), max: String(max) }),
    ready > 0 && format(p.summaryReady, { count: String(ready) }),
    queue.length > 0 && format(p.summaryQueue, { count: String(queue.length) }),
  ].filter(Boolean);

  const tabs: { id: Tab; label: string; count: string; alert?: boolean }[] = [
    { id: "loans", label: p.tabLoans, count: String(loans.length) },
    { id: "reservations", label: p.tabReservations, count: String(groups.length) },
    { id: "waitlist", label: p.tabWaitlist, count: String(queue.length) },
    { id: "fines", label: p.tabFines, count: formatMoney(balance, locale), alert: balance > 0 },
  ];

  return (
    <>
      <div className="flex flex-col gap-3.5">
        <span className="eyebrow text-plum-500">{p.eyebrow}</span>
        <h1 className="m-0 font-serif text-[44px] leading-[.98] font-light md:text-[clamp(52px,5vw,76px)] md:leading-[.96]">{p.title}</h1>
        <p className="m-0 text-base text-ink-muted">{summary.join(" · ")}</p>
      </div>

      <nav aria-label={p.tabs} className="-mt-5 flex flex-wrap gap-x-9 gap-y-1 border-b border-line">
        {tabs.map((x) => (
          <Link
            key={x.id}
            href={x.id === "loans" ? "?" : `?tab=${x.id}`}
            scroll={false}
            aria-current={x.id === tab ? "page" : undefined}
            className={`-mb-px inline-flex h-13 items-center gap-2 border-b-2 text-base no-underline ${
              x.id === tab ? "border-plum-700 font-medium text-ink" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {x.label}
            <span className={`px-1.75 py-0.5 text-xs font-normal ${x.alert ? "bg-overdue-bg text-overdue" : "bg-paper-2 text-ink"}`}>{x.count}</span>
          </Link>
        ))}
      </nav>

      <div key={tab} className="-mt-4 animate-swap">
        {tab === "loans" && <LoansTab loans={loans} rules={rules} t={t} locale={locale} />}
        {tab === "reservations" && <ReservationsTab groups={groups} t={t} locale={locale} />}
        {tab === "waitlist" && <WaitlistTab queue={queue} rules={rules} t={t} locale={locale} />}
        {tab === "fines" && <FinesTab fines={fines} loans={loans} balance={balance} rules={rules} t={t} locale={locale} />}
      </div>
    </>
  );
}

function whyNot(loan: LoanDto, rules: LibrarySettingsDto, p: Dictionary["loansPage"]): string | null {
  if (loan.daysOverdue > 0) return p.whyOverdue;
  if (loan.renewCount >= rules.maxRenewals) return p.whyLimit;
  if (!loan.canRenew) return p.whyWaiting;
  return null;
}

const GRID = "md:grid-cols-[64px_minmax(0,1.6fr)_120px_minmax(150px,1fr)_170px]";

function LoansTab({ loans, rules, t, locale }: { loans: LoanDto[]; rules: LibrarySettingsDto; t: Dictionary; locale: Locale }) {
  const p = t.loansPage;
  const eligible = loans.filter((l) => !whyNot(l, rules, p));
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-ink-muted">{p.returnHint}</span>
        {eligible.length > 1 && (
          <ActionButton
            action={renewAll}
            fields={{ loanIds: eligible.map((l) => l.id).join(",") }}
            label={format(p.renewAll, { count: String(eligible.length) })}
            success={format(p.renewedAll, { count: String(eligible.length) })}
            errors={t.circulationErrors}
            className="eyebrow h-11 border border-ink px-4.5 text-[10.5px] text-ink hover:bg-ink hover:text-paper"
          />
        )}
      </div>
      {loans.length === 0 ? (
        <p className="m-0 border-t border-line pt-6 text-ink-muted">{p.noLoans}</p>
      ) : (
        <div className="border-t border-line">
          <div className={`hidden gap-6 border-b border-line py-3 md:grid ${GRID}`}>
            <span />
            <span className="eyebrow text-[10px] text-ink-muted">{p.colBook}</span>
            <span className="eyebrow text-[10px] text-ink-muted">{p.colBorrowed}</span>
            <span className="eyebrow text-[10px] text-ink-muted">{p.colDue}</span>
            <span />
          </div>
          {loans.map((loan) => {
            const overdue = loan.daysOverdue > 0;
            const bar = overdue ? "bg-overdue" : loan.daysLeft <= 5 ? "bg-gold" : "bg-plum-700";
            const total = rules.loanDays * (loan.renewCount + 1);
            const pct = overdue ? 100 : Math.min(100, Math.max(4, ((total - loan.daysLeft) / total) * 100));
            const why = whyNot(loan, rules, p);
            const left = overdue ? format(t.account.daysOverdue, { days: String(loan.daysOverdue) }) : format(t.account.daysLeft, { days: String(loan.daysLeft) });
            return (
              <div key={loan.id} className={`grid grid-cols-[56px_minmax(0,1fr)] items-center gap-x-4 gap-y-2.5 border-b border-line py-5 md:gap-6 ${GRID}`}>
                <Link href={`/${locale}/books/${loan.book.slug}`} className="row-span-4 self-start md:row-span-1">
                  <BookCover book={loan.book} sizes="56px" className="w-14" />
                </Link>
                <div className="flex min-w-0 flex-col gap-0.75">
                  <Link href={`/${locale}/books/${loan.book.slug}`} lang={loan.book.language} className="font-serif text-[23px] leading-[1.1] text-ink no-underline hover:text-plum-500">
                    {loan.book.title}
                  </Link>
                  <span className="text-sm text-ink-muted">
                    {loan.book.authors.map((a) => a.name).join(", ")} · {format(p.copy, { barcode: loan.copyBarcode })}
                  </span>
                </div>
                <span className="text-sm text-ink-muted">{formatShortDate(loan.checkedOutAt, locale)}</span>
                <div className="flex flex-col gap-1.75">
                  <span className="flex justify-between gap-2 text-sm">
                    <span>{formatDay(loan.dueAt, locale)}</span>
                    <span className={`eyebrow text-[9.5px] ${overdue ? "text-overdue" : loan.daysLeft <= 5 ? "text-ready" : "text-available"}`}>{left}</span>
                  </span>
                  <div className="flex h-1 bg-line">
                    <div className={bar} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-ink-muted">
                    {overdue
                      ? format(p.fineSoFar, { amount: formatMoney(loan.fineAmount, locale) })
                      : loan.renewCount < rules.maxRenewals
                        ? format(t.account.renewalsLeft, { count: String(rules.maxRenewals - loan.renewCount) })
                        : t.account.noRenewalsLeft}
                  </span>
                </div>
                {why ? (
                  <span className="text-[13px] leading-[1.4] text-ink-muted">{why}</span>
                ) : (
                  <ActionButton
                    action={renewLoan}
                    fields={{ loanId: loan.id }}
                    label={format(p.renew, { days: String(rules.loanDays) })}
                    errors={t.circulationErrors}
                    success={t.account.renewed}
                    locale={locale}
                    className="eyebrow h-11 w-full border border-ink text-[10.5px] text-ink hover:bg-ink hover:text-paper"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReservationsTab({ groups, t, locale }: { groups: ReservationGroup[]; t: Dictionary; locale: Locale }) {
  const p = t.loansPage;
  if (!groups.length) return <p className="m-0 text-ink-muted">{p.noReservations}</p>;
  const steps: Partial<Record<ReservationDto["status"], number>> = { READY: 2, FULFILLED: 4, EXPIRED: 4, CANCELLED: 4 };
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => {
        const first = g.reservations[0];
        const open = g.status === "READY";
        const n = steps[g.status] ?? 1;
        const closed = formatShortDate(first.closedAt ?? first.createdAt, locale);
        const detail =
          g.status === "READY" && first.expiresAt
            ? format(p.readyDetail, { date: formatDay(first.expiresAt, locale), time: formatTime(first.expiresAt, locale) })
            : g.status === "EXPIRED"
              ? format(p.expiredDetail, { date: closed })
              : g.status === "FULFILLED"
                ? format(p.collectedDetail, { date: closed })
                : format(p.cancelledDetail, { date: closed });
        const badge = open ? "bg-ready-bg text-ready border-ready-bg" : g.status === "FULFILLED" ? "bg-available-bg text-available border-available-bg" : "bg-stone-bg text-stone border-stone-bg";
        return (
          <article key={g.code} className={`flex flex-wrap items-center gap-x-8 gap-y-5 border border-line p-6 ${open ? "bg-paper-3" : ""}`}>
            <div className="flex flex-[0_0_140px] flex-col gap-1.5">
              <span className="font-medium tracking-[.08em]">{g.code}</span>
              <span className="text-[13px] text-ink-muted">{`${formatDay(first.createdAt, locale)} · ${formatTime(first.createdAt, locale)}`}</span>
            </div>
            <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2.5">
              <span className="font-serif text-[21px] leading-[1.2]">{g.reservations.map((r) => r.book.title).join(" · ")}</span>
              <span aria-label={format(t.account.stepLabel, { step: String(n + 1 > 4 ? 4 : n + 1), status: t.account.reservationStatus[g.status] })} className="grid max-w-80 grid-cols-4 gap-1.25">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={`h-0.75 ${i < n ? "bg-plum-700" : i === n ? "bg-gold" : "bg-line"}`} />
                ))}
              </span>
              <span className="text-[13px] text-ink-muted">{detail}</span>
            </div>
            <span className="flex-[0_0_150px]">
              <span className={`eyebrow rounded-xs border px-2.25 py-1.25 text-[10px] ${badge}`}>{t.account.reservationStatus[g.status]}</span>
            </span>
            <div className="flex flex-[0_0_170px] flex-col items-start gap-1.5">
              {open ? (
                <>
                  <Link href={`/${locale}/reservations/confirmed?ids=${g.reservations.map((r) => r.id).join(",")}`} className="eyebrow py-1.5 text-[10.5px] text-ink no-underline hover:text-plum-500">
                    {t.account.pickupPass}
                  </Link>
                  <ActionButton
                    action={cancelReservation}
                    fields={{ reservationIds: g.reservations.filter((r) => r.status === "READY").map((r) => r.id).join(",") }}
                    label={p.cancel}
                    errors={t.circulationErrors}
                    success={t.reservation.cancelled}
                    className="eyebrow h-8 text-[10px] text-overdue underline underline-offset-4"
                  />
                </>
              ) : g.status === "FULFILLED" ? (
                <Link href={`/${locale}/account/loans`} className="eyebrow py-1.5 text-[10.5px] text-ink no-underline hover:text-plum-500">
                  {p.viewLoan}
                </Link>
              ) : (
                <Link href={`/${locale}/books/${first.book.slug}`} className="eyebrow py-1.5 text-[10.5px] text-ink no-underline hover:text-plum-500">
                  {t.account.reserveAgain}
                </Link>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function WaitlistTab({ queue, rules, t, locale }: { queue: ReservationDto[]; rules: LibrarySettingsDto; t: Dictionary; locale: Locale }) {
  const p = t.loansPage;
  return (
    <div className="flex flex-col gap-4">
      {queue.length === 0 && <p className="m-0 text-ink-muted">{p.noWaitlist}</p>}
      {queue.map((r) => {
        const position = r.queuePosition ?? 1;
        return (
          <article key={r.id} className="flex flex-wrap items-center gap-x-9 gap-y-6 border border-line bg-paper-3 p-7">
            <Link href={`/${locale}/books/${r.book.slug}`} className="flex-none">
              <BookCover book={r.book} sizes="72px" className="w-18" />
            </Link>
            <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
              <Link href={`/${locale}/books/${r.book.slug}`} lang={r.book.language} className="font-serif text-[26px] leading-[1.1] text-ink no-underline hover:text-plum-500">
                {r.book.title}
              </Link>
              <span className="text-sm text-ink-muted">
                {r.book.authors.map((a) => a.name).join(", ")} · {format(p.joined, { date: formatShortDate(r.createdAt, locale) })}
              </span>
            </div>
            <div className="flex flex-[0_1_260px] flex-col gap-2.5">
              <span className="flex items-center gap-2">
                {Array.from({ length: Math.min(position, 5) }, (_, i) => {
                  const you = i === Math.min(position, 5) - 1;
                  return (
                    <span key={i} className={`inline-flex size-7.5 items-center justify-center rounded-full text-xs ${you ? "bg-plum-700 text-paper" : "bg-line"}`}>
                      {you ? position : i + 1}
                    </span>
                  );
                })}
              </span>
              <span className="text-sm">
                <strong className="font-medium">{format(p.position, { n: String(position) })}</strong>
                {r.book.availability.nextDueAt && ` · ${format(p.nextBack, { date: formatShortDate(r.book.availability.nextDueAt, locale) })}`}
              </span>
            </div>
            <ActionButton
              action={cancelReservation}
              fields={{ reservationIds: r.id }}
              label={p.leave}
              errors={t.circulationErrors}
              success={t.reservation.cancelled}
              className="eyebrow h-11 px-4.5 text-[10.5px] text-overdue underline underline-offset-5"
            />
          </article>
        );
      })}
      <p className="m-0 max-w-155 text-sm leading-relaxed text-ink-muted">{format(p.waitlistNote, { hours: String(rules.pickupWindowHours) })}</p>
    </div>
  );
}

function FinesTab({ fines, loans, balance, rules, t, locale }: { fines: FineDto[]; loans: LoanDto[]; balance: number; rules: LibrarySettingsDto; t: Dictionary; locale: Locale }) {
  const p = t.loansPage;
  const money = (n: number) => formatMoney(n, locale);
  const overdue = loans.filter((l) => l.daysOverdue > 0);
  const row = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-2 border-b border-line py-4.5 md:grid-cols-[minmax(0,1fr)_120px_110px]";
  return (
    <div className="flex flex-wrap items-start gap-8">
      <div className="flex-[1_1_420px] border-t border-line">
        {overdue.length + fines.length === 0 && <p className="m-0 py-6 text-ink-muted">{p.noFines}</p>}
        {overdue.map((loan) => (
          <div key={loan.id} className={row}>
            <span className="flex flex-col gap-0.75">
              <span className="text-[15px]">{format(p.fineTitle, { title: loan.book.title, reason: t.account.fineReasons.OVERDUE })}</span>
              <span className="text-[13px] text-ink-muted">{format(p.stillOnLoan, { days: String(loan.daysOverdue), fine: money(rules.finePerDay) })}</span>
            </span>
            <span className="text-right text-[15px] text-overdue tabular-nums">{money(loan.fineAmount)}</span>
            <span className="eyebrow col-span-2 text-[9.5px] text-overdue md:col-span-1 md:text-right">{p.accruing}</span>
          </div>
        ))}
        {fines.map((fine) => (
          <div key={fine.id} className={row}>
            <span className="flex flex-col gap-0.75">
              <span className="text-[15px]">{format(p.fineTitle, { title: fine.bookTitle, reason: t.account.fineReasons[fine.reason] })}</span>
              <span className="text-[13px] text-ink-muted">{formatShortDate(fine.issuedAt, locale)}</span>
            </span>
            <span className={`text-right text-[15px] tabular-nums ${fine.status === "UNPAID" ? "text-overdue" : "text-ink-muted"}`}>{money(fine.amount)}</span>
            <span className={`eyebrow col-span-2 text-[9.5px] md:col-span-1 md:text-right ${fine.status === "UNPAID" ? "text-overdue" : "text-available"}`}>
              {format(p.fineStatus[fine.status], { date: fine.paidAt ? formatShortDate(fine.paidAt, locale) : "" })}
            </span>
          </div>
        ))}
      </div>
      <aside className="flex flex-[0_1_320px] flex-col gap-3.5 border border-line bg-paper-3 p-7">
        <span className="eyebrow text-[10px] text-ink-muted">{p.openBalance}</span>
        <span className={`font-serif text-[52px] leading-none ${balance > 0 ? "text-overdue" : "text-ink-muted"}`}>{money(balance)}</span>
        <span className="text-[13px] leading-normal text-ink-muted">
          {overdue.length
            ? format(p.balanceGrows, { fine: money(rules.finePerDay), limit: money(rules.fineBlockThreshold) })
            : format(p.balanceNote, { limit: money(rules.fineBlockThreshold) })}
        </span>
        <span className="text-[13px] text-ink-muted">{p.payAtDesk}</span>
      </aside>
    </div>
  );
}
