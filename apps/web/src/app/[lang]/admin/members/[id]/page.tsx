import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CircleAlert } from "lucide-react";
import type { AdminMemberDto, LoanDto, MemberHistoryItemDto } from "@mybook/shared";
import { AdminSearch } from "@/components/admin/admin-search";
import { AdminTopBar } from "@/components/admin/admin-top-bar";
import { BookCover } from "@/components/book-cover";
import { FormMessage } from "@/components/form";
import type { Locale } from "@/i18n/config";
import { format, getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { api, ApiError } from "@/lib/api";
import { getRules } from "@/lib/catalog";
import { formatDay, formatMoney, formatShortDate, initials } from "@/lib/format";
import { qrSvg } from "@/lib/qr";
import { getStaff } from "@/lib/staff";
import { BlockControl, CancelReservationButton, FinesCard, NotesCard, RenewButton, RoleControl } from "./member-controls";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.admin.members.title };
}

/** B17 detail: one member's loans, reservations, fines and history, and what the desk can do about them. */
export default async function MemberPage({ params }: PageProps<"/[lang]/admin/members/[id]">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div aria-hidden className="m-10 h-96 animate-pulse bg-paper-2" />}>
      <MemberView t={t} locale={locale} params={params} />
    </Suspense>
  );
}

const monthYear = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", { month: "short", year: "numeric", timeZone: "Europe/Istanbul" }).format(new Date(iso));

async function MemberView({ t, locale, params }: { t: Dictionary; locale: Locale; params: PageProps<"/[lang]/admin/members/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const k = t.admin.member;
  const errors = t.admin.memberErrors;

  let member: AdminMemberDto;
  try {
    member = await api<AdminMemberDto>(`/admin/members/${id}`, { auth: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    return <FormMessage tone="error">{t.admin.apiUnavailable}</FormMessage>;
  }
  const [staff, rules, qr] = await Promise.all([getStaff(), getRules(), qrSvg(`MYBOOK:MEMBER:${member.profile.cardNumber}`)]);
  const p = member.profile;
  const blocked = p.status === "BLOCKED";
  const self = staff.id === p.id;
  const overdue = member.loans.filter((l) => l.daysOverdue > 0).length;
  const ready = member.reservations.filter((r) => r.status === "READY").length;
  const waiting = member.reservations.length - ready;
  const openFines = member.fines.filter((f) => f.status === "UNPAID").reduce((sum, f) => sum + f.amount, 0);
  const firstName = p.fullName.split(/\s+/)[0];

  return (
    <>
      <AdminTopBar staff={{ name: staff.fullName, role: t.admin.roles[staff.role] }} languageLabel={t.nav.language}>
        <AdminSearch action={`/${locale}/admin/desk`} label={t.admin.search} placeholder={t.admin.searchPlaceholder} />
      </AdminTopBar>
      <main className="flex flex-col gap-7 px-3.5 pt-7 pb-12 sm:px-10">
        <nav aria-label={k.breadcrumb} className="text-sm text-ink-muted">
          <Link href={`/${locale}/admin/members`} className="text-ink-muted hover:text-ink">
            {t.admin.members.title}
          </Link>{" "}
          <span aria-hidden>/</span>{" "}
          <span aria-current="location" className="text-ink">
            {p.fullName}
          </span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex items-center gap-5.5">
            <span aria-hidden className={`inline-flex size-21 flex-none items-center justify-center rounded-full font-serif text-[34px] text-paper ${blocked ? "bg-ink" : "bg-plum-700"}`}>
              {initials(p.fullName)}
            </span>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="m-0 font-serif text-[36px] leading-none font-light sm:text-[48px]">{p.fullName}</h1>
                <span className={`eyebrow rounded-xs px-2.25 py-1 text-[10px] ${blocked ? "bg-overdue-bg text-overdue" : "bg-available-bg text-available"}`}>
                  {blocked ? t.admin.members.statuses.blocked : t.admin.members.statuses.active}
                </span>
              </div>
              <span className="text-[15px] text-ink-muted">
                {[t.auth.memberTypes[p.memberType], p.faculty].filter(Boolean).join(" · ")}
                {p.studentNumber && <span className="tabular-nums"> · {p.studentNumber}</span>}
              </span>
              <span className="text-sm text-ink-muted">
                {[p.email, format(k.since, { date: monthYear(p.createdAt, locale) }), format(k.card, { number: p.cardNumber })].join(" · ")}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {!blocked && (
              <Link href={`/${locale}/admin/desk?member=${p.id}`} className="eyebrow inline-flex h-11.5 items-center bg-plum-700 px-5 text-[10px] text-paper no-underline hover:bg-plum-900">
                {format(k.checkOut, { name: firstName })}
              </Link>
            )}
            <a href={`mailto:${p.email}`} className="eyebrow inline-flex h-11.5 items-center border border-ink px-4.5 text-[10px] text-ink no-underline hover:bg-ink hover:text-paper">
              {k.message}
            </a>
            {!self && <BlockControl memberId={p.id} name={p.fullName} blocked={blocked} text={k} errors={errors} />}
          </div>
        </div>

        {blocked && (
          <div role="status" className="flex flex-wrap items-center gap-x-5 gap-y-3 bg-overdue-bg px-5 py-4 text-[15px] text-overdue">
            <CircleAlert aria-hidden size={20} strokeWidth={1.5} />
            <span className="flex-1">
              <strong className="font-medium">{k.blockedBanner}</strong>
              {member.blockedReason ? ` · ${member.blockedReason}` : ""}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 min-[1180px]:grid-cols-4">
          <Kpi label={k.kpiLoans} value={String(member.standing.activeLoans)} suffix={`/ ${member.standing.maxActiveLoans}`}>
            <span className={overdue ? "text-overdue" : ""}>{overdue ? format(k.kpiOverdue, { count: String(overdue) }) : k.kpiNoOverdue}</span>
          </Kpi>
          <Kpi label={k.kpiReservations} value={String(member.reservations.length)}>
            {[ready ? format(k.kpiReady, { count: String(ready) }) : null, waiting ? format(k.kpiWaiting, { count: String(waiting) }) : null].filter(Boolean).join(" · ") || "—"}
          </Kpi>
          <Kpi label={k.kpiFines} value={formatMoney(openFines + member.accruingFines, locale)} tone={openFines + member.accruingFines > 0 ? "text-overdue" : "text-available"}>
            {format(k.kpiFinesNote, { limit: formatMoney(rules.fineBlockThreshold, locale) })}
          </Kpi>
          <Kpi label={format(k.kpiYear, { year: String(member.year.year) })} value={String(member.year.borrowed)}>
            {member.year.returnedOnTimePct === null ? k.kpiNoReturns : format(k.kpiOnTime, { pct: String(member.year.returnedOnTimePct) })}
          </Kpi>
        </div>

        <div className="flex flex-wrap items-start gap-8">
          <div className="flex min-w-0 flex-[2_1_560px] flex-col gap-9">
            <Loans loans={member.loans} t={t} locale={locale} maxRenewals={rules.maxRenewals} />
            <section aria-labelledby="h-res" className="flex flex-col gap-3.5">
              <h2 id="h-res" className="m-0 font-serif text-[28px] font-normal">
                {k.reservationsTitle}
              </h2>
              <div className="flex flex-col border-t border-ink">
                {member.reservations.length === 0 && <p className="m-0 py-4 text-[15px] text-ink-muted">{k.noReservations}</p>}
                {member.reservations.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-b border-line py-4">
                    <span className={`w-30 font-serif text-[22px] tracking-[.06em] ${r.status === "READY" ? "" : "text-ink-muted"}`}>
                      {r.status === "READY" ? r.code : `#${r.queuePosition ?? "–"}`}
                    </span>
                    <span className="flex flex-[1_1_240px] flex-col text-[15px]">
                      <span>{r.book.title}</span>
                      <span className="text-[13px] text-ink-muted">
                        {format(k.placed, { date: formatShortDate(r.createdAt, locale) })}
                        {r.copyBarcode ? ` · ${r.copyBarcode}` : ""}
                        {r.shelfLocation ? ` · ${r.shelfLocation}` : ""}
                      </span>
                    </span>
                    <span className={`eyebrow rounded-xs px-2.25 py-1 text-[10px] ${r.status === "READY" ? "bg-ready-bg text-ready" : "bg-loan-bg text-loan"}`}>
                      {r.status === "READY" && r.expiresAt ? format(k.ready, { date: formatDay(r.expiresAt, locale) }) : format(k.queue, { position: String(r.queuePosition ?? "–") })}
                    </span>
                    <CancelReservationButton reservationId={r.id} text={k} errors={errors} />
                  </div>
                ))}
              </div>
            </section>
            <History items={member.history} t={t} locale={locale} />
          </div>

          <aside className="flex max-w-100 flex-[1_1_300px] flex-col gap-5">
            <FinesCard fines={member.fines} accruing={member.accruingFines} locale={locale} text={k} errors={errors} />
            <section className="flex flex-col gap-3 border border-line bg-paper-3 p-5.5">
              <h2 className="eyebrow m-0 text-[11px]">{k.cardTitle}</h2>
              <div className="flex items-center gap-4">
                <div role="img" aria-label={p.cardNumber} className="size-21 flex-none bg-paper p-1.5 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
                <span className="flex flex-col gap-1 text-sm">
                  <span className="tabular-nums">{p.cardNumber}</span>
                  {p.studentNumber && <span className="text-ink-muted tabular-nums">{p.studentNumber}</span>}
                </span>
              </div>
            </section>
            <RoleControl memberId={p.id} role={p.role} editable={staff.role === "ADMIN" && !self} self={self} roles={t.admin.roles} text={k} errors={errors} />
            <NotesCard memberId={p.id} notes={member.notes} locale={locale} text={k} errors={errors} />
          </aside>
        </div>
      </main>
    </>
  );
}

function Kpi({ label, value, suffix, tone = "", children }: { label: string; value: string; suffix?: string; tone?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 bg-paper-3 px-5.5 py-4.5">
      <span className="eyebrow text-[10px] text-ink-muted">{label}</span>
      <span className={`font-serif text-[38px] leading-none tabular-nums ${tone}`}>
        {value}
        {suffix && <span className="text-xl text-ink-muted"> {suffix}</span>}
      </span>
      <span className="text-[13px] text-ink-muted">{children}</span>
    </div>
  );
}

const TH = "eyebrow border-b border-ink px-3.5 pb-3 text-left text-[10px] font-medium whitespace-nowrap text-ink-muted";
const TD = "border-b border-line px-3.5 py-3.5 align-middle";

function Loans({ loans, t, locale, maxRenewals }: { loans: LoanDto[]; t: Dictionary; locale: Locale; maxRenewals: number }) {
  const k = t.admin.member;
  const note = (l: LoanDto) =>
    l.daysOverdue > 0
      ? { text: format(k.late, { days: String(l.daysOverdue), fine: formatMoney(l.fineAmount, locale) }), tone: "text-overdue" }
      : !l.canRenew && l.renewCount < maxRenewals
        ? { text: k.waiting, tone: "text-ready" }
        : l.renewCount < maxRenewals
          ? { text: format(k.renewalsLeft, { count: String(maxRenewals - l.renewCount) }), tone: "text-ink-muted" }
          : { text: k.noRenewals, tone: "text-ink-muted" };
  const why = (l: LoanDto) => (l.canRenew ? null : l.daysOverdue > 0 ? k.whyOverdue : l.renewCount >= maxRenewals ? k.whyLimit : k.whyWaiting);
  return (
    <section aria-labelledby="h-loans" className="flex flex-col gap-3.5">
      <h2 id="h-loans" className="m-0 font-serif text-[28px] font-normal">
        {k.loansTitle}
      </h2>
      {loans.length === 0 ? (
        <p className="m-0 border-t border-ink py-4 text-[15px] text-ink-muted">{k.noLoans}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-150 border-collapse text-[15px]">
            <thead>
              <tr>
                <th className={TH}>{k.colBook}</th>
                <th className={TH}>{k.colCopy}</th>
                <th className={TH}>{k.colBorrowed}</th>
                <th className={TH}>{k.colDue}</th>
                <th className={TH}>
                  <span className="sr-only">{k.colActions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => {
                const n = note(l);
                return (
                  <tr key={l.id} className="hover:bg-paper-3">
                    <td className={TD}>
                      <span className="flex items-center gap-3">
                        <BookCover book={l.book} sizes="28px" className="w-7" />
                        <span className="flex flex-col">
                          <span className="font-serif text-lg leading-[1.15]">{l.book.title}</span>
                          <span className="text-[13px] text-ink-muted">{l.book.authors.map((a) => a.name).join(", ")}</span>
                        </span>
                      </span>
                    </td>
                    <td className={`${TD} text-sm whitespace-nowrap tabular-nums`}>{l.copyBarcode}</td>
                    <td className={`${TD} text-sm whitespace-nowrap text-ink-muted`}>{formatShortDate(l.checkedOutAt, locale)}</td>
                    <td className={TD}>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm whitespace-nowrap">{formatDay(l.dueAt, locale)}</span>
                        <span className={`text-xs whitespace-nowrap ${n.tone}`}>{n.text}</span>
                      </span>
                    </td>
                    <td className={`${TD} text-right whitespace-nowrap`}>
                      <span className="inline-flex items-start gap-1.5">
                        <RenewButton loanId={l.id} disabledReason={why(l)} locale={locale} text={k} errors={t.admin.memberErrors} />
                        <Link
                          href={`/${locale}/admin/desk?q=${l.copyBarcode}`}
                          className="eyebrow inline-flex h-8 items-center border border-ink px-3 text-[9px] text-ink no-underline hover:bg-ink hover:text-paper"
                        >
                          {k.checkIn}
                        </Link>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function History({ items, t, locale }: { items: MemberHistoryItemDto[]; t: Dictionary; locale: Locale }) {
  const k = t.admin.member;
  const tone = (h: MemberHistoryItemDto) =>
    h.kind === "returned" ? (h.daysLate ? "text-ready" : "text-available") : h.kind === "expired" || h.kind === "blocked" ? "text-overdue" : h.kind === "collected" ? "text-available" : "text-ink-muted";
  const noteFor = (h: MemberHistoryItemDto) =>
    h.kind !== "returned" ? "" : h.daysLate ? [format(k.daysLate, { days: String(h.daysLate) }), h.fine ? formatMoney(h.fine, locale) : null].filter(Boolean).join(" · ") : k.onTime;
  return (
    <section aria-labelledby="h-hist" className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="h-hist" className="m-0 font-serif text-[28px] font-normal">
          {k.historyTitle}
        </h2>
        <span className="text-[13px] text-ink-muted">{k.historyNote}</span>
      </div>
      <ol className="m-0 flex list-none flex-col border-t border-ink p-0">
        {items.length === 0 && <li className="py-3.5 text-[15px] text-ink-muted">{k.noHistory}</li>}
        {items.map((h, i) => (
          <li key={`${h.at}-${h.kind}-${i}`} className="flex flex-wrap gap-x-5 gap-y-1.5 border-b border-line py-3.25 text-[15px]">
            <span className="w-22.5 text-sm text-ink-muted tabular-nums">{formatShortDate(h.at, locale)}</span>
            <span className="flex-[1_1_260px]">{format(k.history[h.kind], { title: h.bookTitle ?? "", code: h.code ?? "" })}</span>
            <span className={`text-[13px] ${tone(h)}`}>{noteFor(h)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
