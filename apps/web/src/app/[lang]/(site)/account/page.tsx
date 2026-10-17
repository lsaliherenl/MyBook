import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import type { FineDto, LibrarySettingsDto, LoanDto, ProfileDto, ReservationDto } from "@mybook/shared";
import { LoanCard } from "@/components/account/loan-card";
import { groupReservations, ReservationRow } from "@/components/account/reservation-row";
import { ArrowLink } from "@/components/section-heading";
import type { Locale } from "@/i18n/config";
import { format, getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { api } from "@/lib/api";
import { getRules } from "@/lib/catalog";
import { formatMoney, formatShortDate } from "@/lib/format";
import { getMemberCirculation } from "@/lib/member";
import { qrSvg } from "@/lib/qr";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).account.title, robots: { index: false } };
}

/** "Good evening" and "Friday, October 16" for right now in Istanbul. */
function greetingFor(locale: Locale, t: Dictionary["account"]["greeting"]) {
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Istanbul" }).format(now));
  const greeting = hour < 5 ? t.night : hour < 12 ? t.morning : hour < 18 ? t.day : hour < 22 ? t.evening : t.night;
  const date = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Istanbul",
  }).format(now);
  return { greeting, date };
}

export default async function AccountOverviewPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const [profile, circulation, reservations, fines, rules] = await Promise.all([
    api<ProfileDto>("/me", { auth: true }),
    getMemberCirculation(),
    api<ReservationDto[]>("/me/reservations", { auth: true }).catch(() => []),
    api<FineDto[]>("/me/fines", { auth: true }).catch(() => []),
    getRules(),
  ]);
  const a = t.account;
  const loans = circulation?.activeLoans ?? [];
  const standing = circulation?.standing;
  const overdue = loans.filter((l) => l.daysOverdue > 0);
  const ready = reservations.filter((r) => r.status === "READY").length;
  const queued = reservations.filter((r) => r.status === "PENDING").length;
  const unpaid = fines.filter((f) => f.status === "UNPAID").reduce((sum, f) => sum + f.amount, 0);
  const accruing = overdue.reduce((sum, l) => sum + l.fineAmount, 0);
  const toSettle = unpaid + accruing;
  const { greeting, date } = greetingFor(locale, a.greeting);

  const summary = [
    loans.length === 0 ? a.summaryNoBooks : loans.length === 1 ? a.summaryBooksOne : format(a.summaryBooks, { count: String(loans.length) }),
    ready > 0 && format(a.summaryReady, { count: String(ready) }),
    queued > 0 && format(a.summaryPending, { count: String(queued) }),
    toSettle > 0 && format(a.summaryFines, { amount: formatMoney(toSettle, locale) }),
  ].filter(Boolean);

  return (
    <>
      <div className="flex flex-col gap-2.5 md:gap-3.5">
        <span className="eyebrow text-plum-500">{date}</span>
        <h1 className="m-0 font-serif text-[46px] leading-[.98] font-light md:text-[clamp(52px,5vw,76px)] md:leading-[.96]">
          {format(greeting, { name: profile.fullName.split(" ")[0] })}
        </h1>
        <p className="m-0 text-[15px] text-ink-muted md:text-[17px]">{summary.join(" · ")}</p>
      </div>

      {overdue.length > 0 && (
        <div role="alert" className="-mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 bg-overdue-bg px-4 py-3.5 text-overdue md:-mt-6 md:px-5.5 md:py-4.5">
          <AlertCircle aria-hidden size={20} strokeWidth={1.5} className="flex-none" />
          <span className="min-w-0 flex-1 text-sm md:text-[15px]">
            <strong className="font-medium">
              {overdue.length === 1
                ? format(a.overdueAlert, { title: overdue[0].book.title, days: String(overdue[0].daysOverdue) })
                : format(a.overdueAlertMany, { count: String(overdue.length) })}
            </strong>{" "}
            {format(a.overdueHint, { fine: formatMoney(rules.finePerDay, locale) })}
          </span>
          <Link href={`/${locale}/about#rules`} className="eyebrow text-overdue underline underline-offset-5">
            {a.howToReturn}
          </Link>
        </div>
      )}
      {standing && !standing.canBorrow && standing.blockedReason && standing.blockedReason !== "loan_overdue" && (
        <div role="alert" className="-mt-8 bg-overdue-bg px-5.5 py-4.5 text-[15px] text-overdue md:-mt-6">
          {format(a.blocked, { reason: t.circulationErrors[standing.blockedReason] })}
        </div>
      )}

      <section aria-labelledby="h-loans" className="flex flex-col gap-4 md:gap-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="h-loans" className="m-0 font-serif text-[32px] font-normal md:text-[40px]">
            {a.onLoan}{" "}
            <span className="text-lg text-ink-muted md:text-[22px]">
              · {format(a.ofMax, { count: String(loans.length), max: String(standing?.maxActiveLoans ?? rules.maxActiveLoans) })}
            </span>
          </h2>
          <ArrowLink href={`/${locale}/account/loans`} label={a.allLoans} className="hidden md:inline-flex" />
        </div>
        {loans.length ? (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] md:gap-5">
            {sortLoans(loans).map((loan) => (
              <LoanCard key={loan.id} loan={loan} rules={rules} t={t} locale={locale} />
            ))}
          </div>
        ) : (
          <EmptyNote text={a.noLoans} href={`/${locale}/catalog`} label={a.browse} />
        )}
      </section>

      <section aria-labelledby="h-res" className="flex flex-col gap-5">
        <h2 id="h-res" className="m-0 font-serif text-[32px] font-normal md:text-[40px]">
          {a.reservations}
        </h2>
        {reservations.length ? (
          <div className="flex flex-col border-t border-line">
            {groupReservations(reservations)
              .slice(0, 5)
              .map((group) => (
                <ReservationRow key={group.code} group={group} t={t} locale={locale} pickupHours={rules.pickupWindowHours} />
              ))}
          </div>
        ) : (
          <p className="m-0 text-ink-muted">{a.noReservations}</p>
        )}
      </section>

      <div className="flex flex-wrap items-stretch gap-6">
        <Fines fines={fines} overdue={overdue} toSettle={toSettle} rules={rules} t={t} locale={locale} />
        <LibraryCard profile={profile} t={t} locale={locale} />
      </div>
    </>
  );
}

/** Overdue first, then by due date. */
const sortLoans = (loans: LoanDto[]) => [...loans].sort((x, y) => y.daysOverdue - x.daysOverdue || x.dueAt.localeCompare(y.dueAt));

function EmptyNote({ text, href, label }: { text: string; href: string; label: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border border-line bg-paper-3 p-6">
      <p className="m-0 max-w-110 text-ink-muted">{text}</p>
      <Link href={href} className="eyebrow inline-flex h-12 items-center bg-plum-700 px-5.5 text-xs text-paper no-underline hover:bg-plum-900">
        {label}
      </Link>
    </div>
  );
}

function Fines({
  fines,
  overdue,
  toSettle,
  rules,
  t,
  locale,
}: {
  fines: FineDto[];
  overdue: LoanDto[];
  toSettle: number;
  rules: LibrarySettingsDto;
  t: Dictionary;
  locale: Locale;
}) {
  const a = t.account;
  const money = (n: number) => formatMoney(n, locale);
  return (
    <section aria-labelledby="h-fines" className="flex flex-[1_1_340px] flex-col gap-4.5 border border-line bg-paper-3 p-7">
      <div className="flex items-baseline justify-between">
        <h2 id="h-fines" className="m-0 font-serif text-[32px] font-normal">
          {a.fines}
        </h2>
        <span className={`font-serif text-[40px] ${toSettle > 0 ? "text-overdue" : "text-ink-muted"}`}>{money(toSettle)}</span>
      </div>
      {overdue.length + fines.length > 0 ? (
        <ul className="m-0 list-none border-t border-line p-0 text-sm">
          {overdue.map((loan) => (
            <li key={loan.id} className="flex justify-between gap-4 border-b border-line py-3">
              <span>{format(a.fineLine, { title: loan.book.title, days: String(loan.daysOverdue), fine: money(rules.finePerDay) })}</span>
              <span className="text-overdue">{format(a.fineAccruing, { amount: money(loan.fineAmount) })}</span>
            </li>
          ))}
          {fines.slice(0, 5).map((fine) => (
            <li key={fine.id} className={`flex justify-between gap-4 border-b border-line py-3 ${fine.status === "UNPAID" ? "" : "text-ink-muted"}`}>
              <span>
                {fine.bookTitle} · {a.fineReasons[fine.reason]} · {formatShortDate(fine.issuedAt, locale)}
              </span>
              <span className={fine.status === "UNPAID" ? "text-overdue" : ""}>
                {format(fine.status === "UNPAID" ? a.fineOpen : fine.status === "PAID" ? a.finePaid : a.fineWaived, { amount: money(fine.amount) })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-ink-muted">{a.noFines}</p>
      )}
      <span className="text-[13px] leading-normal text-ink-muted">{format(a.finesNote, { limit: money(rules.fineBlockThreshold) })}</span>
    </section>
  );
}

async function LibraryCard({ profile, t, locale }: { profile: ProfileDto; t: Dictionary; locale: Locale }) {
  const a = t.account;
  const qr = await qrSvg(`MYBOOK:MEMBER:${profile.cardNumber}`);
  return (
    <section aria-label={a.digitalCard} className="flex flex-[1_1_340px] flex-col bg-plum-700 text-cream shadow-[0_30px_60px_-24px_rgba(46,20,36,.6)]">
      <div className="flex items-center justify-between border-b border-cream/18 px-6.5 py-5.5">
        <span className="flex flex-col gap-1">
          <span className="font-serif text-lg tracking-[.26em]">{t.brand.name}</span>
          <span className="eyebrow text-[8.5px] tracking-[.3em] text-[#D8C2CF]">{a.card}</span>
        </span>
        <span className="eyebrow border border-cream/50 px-2 py-1 text-[9px]">{t.auth.memberTypes[profile.memberType]}</span>
      </div>
      <div className="flex flex-1 items-center gap-5.5 px-6.5 py-6">
        <div className="flex-none bg-paper-3 p-2.5">
          <div role="img" aria-label={a.showCard} className="size-30 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="font-serif text-[26px] leading-[1.1]">{profile.fullName}</span>
          <span className="text-sm tracking-[.08em] text-[#E3D3DB]">{profile.studentNumber ?? profile.cardNumber}</span>
          <span className="text-[13px] text-[#D8C2CF]">
            {profile.faculty && (
              <>
                {profile.faculty}
                <br />
              </>
            )}
            {format(a.cardNumber, { number: profile.cardNumber })}
            <br />
            {format(a.memberSince, { date: new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", { month: "short", year: "numeric" }).format(new Date(profile.createdAt)) })}
          </span>
        </div>
      </div>
      <span className="border-t border-cream/18 px-6.5 py-4 text-center text-[11px] tracking-[.18em] text-[#D8C2CF] uppercase">{a.showCard}</span>
    </section>
  );
}
