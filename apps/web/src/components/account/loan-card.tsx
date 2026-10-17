import Link from "next/link";
import type { LibrarySettingsDto, LoanDto } from "@mybook/shared";
import { renewLoan } from "@/app/[lang]/(site)/circulation-actions";
import type { Locale } from "@/i18n/config";
import { format, type Dictionary } from "@/i18n/get-dictionary";
import { formatDay, formatMoney, formatShortDate } from "@/lib/format";
import { ActionButton } from "../action-button";
import { BookCover } from "../book-cover";

/** Overdue → terracotta, due within 5 days → gold, otherwise plum (top border, bar and label). */
function tone(loan: LoanDto) {
  if (loan.daysOverdue > 0) return { edge: "border-l-overdue md:border-t-overdue", bar: "bg-overdue", text: "text-overdue" };
  if (loan.daysLeft <= 5) return { edge: "border-l-gold md:border-t-gold", bar: "bg-gold", text: "text-ready" };
  return { edge: "border-l-plum-700 md:border-t-plum-700", bar: "bg-plum-700", text: "text-available" };
}

/** One book on loan: due date, a progress bar through the loan period, and Renew (or why not). */
export function LoanCard({ loan, rules, t, locale }: { loan: LoanDto; rules: LibrarySettingsDto; t: Dictionary; locale: Locale }) {
  const a = t.account;
  const c = tone(loan);
  const overdue = loan.daysOverdue > 0;
  const total = rules.loanDays * (loan.renewCount + 1);
  const elapsed = overdue ? 100 : Math.min(100, Math.max(4, ((total - loan.daysLeft) / total) * 100));
  const renewalsLeft = Math.max(0, rules.maxRenewals - loan.renewCount);
  const waiting = loan.book.availability.waiting;
  const blocked = overdue ? a.cantRenewOverdue : renewalsLeft === 0 ? a.cantRenewLimit : waiting > 0 ? a.cantRenewWaiting : null;
  const note = overdue
    ? format(a.wasDue, { date: formatDay(loan.dueAt, locale) })
    : waiting > 0
      ? waiting === 1
        ? a.waitingOne
        : format(a.waiting, { count: String(waiting) })
      : `${format(a.borrowed, { date: formatShortDate(loan.checkedOutAt, locale) })} · ${renewalsLeft ? format(a.renewalsLeft, { count: String(renewalsLeft) }) : a.noRenewalsLeft}`;

  return (
    <article
      // Phones mark the state on the left edge, wider screens on the top edge.
      className={`flex flex-col gap-4 border border-l-3 border-line bg-paper-3 p-4 md:border-t-3 md:border-l md:border-l-line md:p-5.5 ${c.edge}`}
    >
      <div className="flex gap-4">
        <Link href={`/${locale}/books/${loan.book.slug}`} className="flex-none">
          <BookCover book={loan.book} sizes="64px" className="w-13 md:w-16" />
        </Link>
        <div className="flex min-w-0 flex-col gap-0.75">
          <Link href={`/${locale}/books/${loan.book.slug}`} lang={loan.book.language} className="font-serif text-[21px] leading-[1.1] text-ink no-underline hover:text-plum-500 md:text-[23px]">
            {loan.book.title}
          </Link>
          <span className="text-sm text-ink-muted">{loan.book.authors.map((x) => x.name).join(", ")}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between gap-3 text-sm">
          <span className={`eyebrow text-[10px] ${c.text}`}>
            {overdue ? format(a.daysOverdue, { days: String(loan.daysOverdue) }) : loan.daysLeft === 0 ? a.dueToday : format(a.daysLeft, { days: String(loan.daysLeft) })}
          </span>
          {overdue ? (
            <span className="font-medium text-overdue">{formatMoney(loan.fineAmount, locale)}</span>
          ) : (
            <span>{format(a.due, { date: formatDay(loan.dueAt, locale) })}</span>
          )}
        </div>
        <div className="flex h-1 bg-line">
          <div className={c.bar} style={{ width: `${elapsed}%` }} />
        </div>
        <span className="text-[13px] text-ink-muted">{note}</span>
      </div>
      {blocked ? (
        <button type="button" disabled className="eyebrow h-11 cursor-not-allowed border border-[#C9BDB0] text-[11px] text-[#A3969B]">
          {blocked}
        </button>
      ) : (
        <ActionButton
          action={renewLoan}
          fields={{ loanId: loan.id }}
          label={format(a.renew, { days: String(rules.loanDays) })}
          errors={t.circulationErrors}
          success={a.renewed}
          locale={locale}
          className="eyebrow h-11 w-full border border-ink text-[11px] text-ink hover:bg-ink hover:text-paper"
        />
      )}
    </article>
  );
}
