import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { FileDown } from "lucide-react";
import { REPORT_RANGES, type OverdueRowDto, type ReportRange, type ReportSummaryDto } from "@mybook/shared";
import { AdminSearch } from "@/components/admin/admin-search";
import { AdminTopBar } from "@/components/admin/admin-top-bar";
import { AutoSubmitSelect } from "@/components/admin/auto-submit";
import { PrintButton } from "@/components/admin/print-button";
import { BookCover } from "@/components/book-cover";
import { FormMessage } from "@/components/form";
import type { Locale } from "@/i18n/config";
import { format, getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { api } from "@/lib/api";
import { formatDay, formatMoney, formatNumber, localized } from "@/lib/format";
import { getStaff } from "@/lib/staff";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.admin.reports.title };
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const DAY_FILTERS = ["any", "7", "14", "30"] as const;
const MEMBER_TYPES = ["STUDENT", "ACADEMIC", "STAFF"] as const;
const intl = (locale: Locale) => (locale === "tr" ? "tr-TR" : "en-US");

/** B19: how the library is used — loans, on-time returns, readers, fines, categories, top books and the overdue list. */
export default async function ReportsPage({ searchParams }: PageProps<"/[lang]/admin/reports">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div aria-hidden className="m-10 h-96 animate-pulse bg-paper-2" />}>
      <Reports t={t} locale={locale} searchParams={searchParams} />
    </Suspense>
  );
}

async function Reports({ t, locale, searchParams }: { t: Dictionary; locale: Locale; searchParams: Promise<Params> }) {
  const params = await searchParams;
  const r = t.admin.reports;
  const range = (REPORT_RANGES as readonly string[]).includes(one(params.range)) ? (one(params.range) as ReportRange) : "month";
  const days = (DAY_FILTERS as readonly string[]).includes(one(params.days)) ? (one(params.days) as (typeof DAY_FILTERS)[number]) : "any";
  const type = (MEMBER_TYPES as readonly string[]).includes(one(params.type)) ? one(params.type) : "";
  const [staff, summary, overdue] = await Promise.all([
    getStaff(),
    api<ReportSummaryDto>(`/admin/reports/summary?range=${range}`, { auth: true }).catch(() => null),
    api<OverdueRowDto[]>("/admin/reports/overdue", { auth: true }).catch(() => null),
  ]);
  const base = `/${locale}/admin/reports`;
  const href = (changes: Record<string, string>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ range, days, type, ...changes })) {
      if (value && !(key === "range" && value === "month") && !(key === "days" && value === "any")) next.set(key, value);
    }
    return next.size ? `${base}?${next}` : base;
  };

  return (
    <>
      <AdminTopBar staff={{ name: staff.fullName, role: t.admin.roles[staff.role] }} languageLabel={t.nav.language}>
        <AdminSearch action={`/${locale}/admin/desk`} label={t.admin.search} placeholder={t.admin.searchPlaceholder} />
      </AdminTopBar>
      <main className="flex flex-col gap-8 px-3.5 py-10 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex flex-col gap-2">
            <span className="eyebrow text-[10px] text-plum-500">{r.eyebrow}</span>
            <h1 className="m-0 animate-rise font-serif text-[44px] leading-none font-light sm:text-[56px]">{r.title}</h1>
            {summary && (
              <span className="text-[15px] text-ink-muted">
                {formatDay(summary.from, locale)} – {formatDay(summary.to, locale)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div role="group" aria-label={r.rangeLabel} className="flex flex-wrap gap-1.5 print:hidden">
              {REPORT_RANGES.map((key) => (
                <Link
                  key={key}
                  href={href({ range: key })}
                  aria-current={key === range ? "true" : undefined}
                  className={`inline-flex h-9.5 items-center border px-3.5 text-sm no-underline ${key === range ? "border-ink bg-ink text-paper" : "border-line text-ink hover:border-ink"}`}
                >
                  {r.ranges[key]}
                </Link>
              ))}
            </div>
            <PrintButton label={r.print} />
          </div>
        </div>

        {!summary ? (
          <FormMessage tone="error">{t.admin.apiUnavailable}</FormMessage>
        ) : (
          <>
            <Kpis summary={summary} t={t} locale={locale} />
            <div className="flex flex-wrap gap-5">
              <Months summary={summary} t={t} locale={locale} />
              <Categories summary={summary} t={t} locale={locale} />
            </div>
            <TopBooks summary={summary} t={t} locale={locale} />
          </>
        )}
        {overdue && <Overdue rows={overdue} t={t} locale={locale} days={days} type={type} href={href} base={base} range={range} />}
      </main>
    </>
  );
}

function Kpis({ summary: s, t, locale }: { summary: ReportSummaryDto; t: Dictionary; locale: Locale }) {
  const r = t.admin.reports;
  const change = s.loansBefore ? Math.round(((s.loans - s.loansBefore) / s.loansBefore) * 100) : null;
  const pts = s.returnedOnTimePct !== null && s.returnedOnTimePctBefore !== null ? s.returnedOnTimePct - s.returnedOnTimePctBefore : null;
  const signed = (n: number, suffix = "") => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}${suffix}`;
  const tone = (n: number | null) => (n === null || n === 0 ? "text-ink-muted" : n > 0 ? "text-available" : "text-overdue");
  const cards = [
    { label: r.kpiLoans, value: formatNumber(s.loans, locale), note: change === null ? r.noBefore : format(r.vsBefore, { delta: signed(change, "%") }), tone: tone(change) },
    {
      label: r.kpiOnTime,
      value: s.returnedOnTimePct === null ? "—" : `%${s.returnedOnTimePct}`,
      note: s.returnedOnTimePct === null ? r.noReturns : pts === null ? r.noBefore : format(r.pointsBefore, { delta: signed(pts) }),
      tone: tone(pts),
    },
    { label: r.kpiReaders, value: formatNumber(s.activeReaders, locale), note: format(r.readersNote, { pct: String(s.members ? Math.round((s.activeReaders / s.members) * 100) : 0) }), tone: "text-ink-muted" },
    { label: r.kpiFines, value: formatMoney(s.finesCollected, locale), note: format(r.waived, { amount: formatMoney(s.finesWaived, locale) }), tone: "text-ink-muted" },
  ];
  return (
    <div className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 min-[1180px]:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="flex flex-col gap-1.5 bg-paper-3 px-5.5 py-5">
          <span className="eyebrow text-[10px] text-ink-muted">{c.label}</span>
          <span className="font-serif text-[40px] leading-none tabular-nums">{locale === "en" ? c.value.replace(/^%(\d+)$/, "$1%") : c.value}</span>
          <span className={`text-[13px] ${c.tone}`}>{c.note}</span>
        </div>
      ))}
    </div>
  );
}

function Months({ summary: s, t, locale }: { summary: ReportSummaryDto; t: Dictionary; locale: Locale }) {
  const r = t.admin.reports;
  const max = Math.max(1, ...s.months.flatMap((m) => [m.loans, m.previousYear]));
  const label = (month: string) => new Intl.DateTimeFormat(intl(locale), { month: "short", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));
  const [plotTop, plotBottom] = [10, 200];
  const h = (v: number) => (v / max) * (plotBottom - plotTop);
  return (
    <section aria-labelledby="h-trend" className="flex min-w-0 flex-[3_1_520px] flex-col gap-4 border border-line bg-paper-3 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="h-trend" className="m-0 font-serif text-[26px] font-normal">
          {r.monthsTitle}
        </h2>
        <span className="flex gap-4 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 bg-plum-700" />
            {r.thisYear}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 bg-[#c9b3bf]" />
            {r.previousYear}
          </span>
        </span>
      </div>
      <svg
        viewBox="0 0 600 230"
        width="100%"
        role="img"
        aria-label={format(r.monthsAria, { list: s.months.map((m) => `${label(m.month)} ${m.loans}`).join(", ") })}
        className="font-sans"
      >
        <line x1="0" x2="600" y1={plotBottom} y2={plotBottom} stroke="var(--color-line)" />
        {s.months.map((m, i) => {
          const x = 8 + i * 49;
          const last = i === s.months.length - 1;
          return (
            <g key={m.month}>
              <rect x={x} y={plotBottom - h(m.previousYear)} width="16" height={h(m.previousYear)} fill="#c9b3bf">
                <title>{`${label(m.month)} · ${r.previousYear}: ${m.previousYear}`}</title>
              </rect>
              <rect x={x + 18} y={plotBottom - h(m.loans)} width="16" height={h(m.loans)} fill={last ? "var(--color-plum-500)" : "var(--color-plum-700)"}>
                <title>{`${label(m.month)}: ${m.loans}`}</title>
              </rect>
              {(last || m.loans === max) && m.loans > 0 && (
                <text x={x + 26} y={plotBottom - h(m.loans) - 6} fontSize="11" textAnchor="middle" fill="var(--color-ink)">
                  {formatNumber(m.loans, locale)}
                </text>
              )}
              <text x={x + 17} y="222" fontSize="11" textAnchor="middle" fill={last ? "var(--color-ink)" : "var(--color-ink-muted)"} fontWeight={last ? 500 : undefined}>
                {label(m.month)}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

const CATEGORY_COLORS = ["#4a2238", "#6e3b57", "#55684f", "#b88a4a", "#8e4a36", "#241b21", "#9c8a93", "#d6cabb"];

function Categories({ summary: s, t, locale }: { summary: ReportSummaryDto; t: Dictionary; locale: Locale }) {
  const r = t.admin.reports;
  const total = s.categories.reduce((sum, c) => sum + c.loans, 0);
  const top = s.categories.slice(0, 7);
  const rest = s.categories.slice(7).reduce((sum, c) => sum + c.loans, 0);
  const rows = [
    ...top.map((c) => ({ name: c.category ? localized(c.category, "name", locale) : r.uncategorised, loans: c.loans })),
    ...(rest ? [{ name: r.other, loans: rest }] : []),
  ];
  return (
    <section aria-labelledby="h-cat" className="flex min-w-0 flex-[2_1_300px] flex-col gap-4 border border-line bg-paper-3 p-6">
      <h2 id="h-cat" className="m-0 font-serif text-[26px] font-normal">
        {r.categoriesTitle}
      </h2>
      {total === 0 ? (
        <p className="m-0 text-[15px] text-ink-muted">{r.noLoans}</p>
      ) : (
        <>
          <div role="img" aria-label={rows.map((c) => `${c.name} ${Math.round((c.loans / total) * 100)}%`).join(", ")} className="flex h-3.5 overflow-hidden">
            {rows.map((c, i) => (
              <span key={c.name} style={{ width: `${(c.loans / total) * 100}%`, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
            ))}
          </div>
          <ul className="m-0 flex list-none flex-col p-0">
            {rows.map((c, i) => (
              <li key={c.name} className="flex items-center gap-3 border-b border-line py-2.25 text-sm last:border-b-0">
                <span aria-hidden className="size-2.5 flex-none" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                <span className="flex-1">{c.name}</span>
                <span className="tabular-nums">{formatNumber(c.loans, locale)}</span>
                <span className="w-11 text-right text-ink-muted tabular-nums">%{Math.round((c.loans / total) * 100)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function TopBooks({ summary: s, t, locale }: { summary: ReportSummaryDto; t: Dictionary; locale: Locale }) {
  const r = t.admin.reports;
  return (
    <section aria-labelledby="h-top" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="h-top" className="m-0 font-serif text-[32px] font-normal">
          {r.topTitle} · {r.ranges[s.range]}
        </h2>
        <Link href={`/${locale}/admin/books`} className="eyebrow text-[10px] text-ink no-underline hover:text-plum-500 print:hidden">
          {r.allBooks}
        </Link>
      </div>
      {s.topBooks.length === 0 ? (
        <p className="m-0 border-t border-ink pt-4 text-[15px] text-ink-muted">{r.noLoans}</p>
      ) : (
        <ol className="m-0 grid list-none grid-cols-1 gap-x-8 border-t border-ink p-0 md:grid-cols-2">
          {s.topBooks.map((b, i) => (
            <li key={b.book.id} className="flex items-center gap-4 border-b border-line py-3.5">
              <span className="w-7 font-serif text-[26px] text-ink-muted">{i + 1}</span>
              <BookCover book={b.book} sizes="36px" className="w-9" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span lang={b.book.language} className="truncate font-serif text-xl leading-tight">
                  {b.book.title}
                </span>
                <span className="text-[13px] text-ink-muted">
                  {b.book.authors.map((a) => a.name).join(", ")} · {format(r.copies, { count: String(b.copies) })}
                </span>
              </span>
              <span className="flex flex-col items-end">
                <span className="font-serif text-[26px] leading-none tabular-nums">{b.loans}</span>
                <span className="text-xs text-ink-muted">{r.loansUnit}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Overdue({
  rows,
  t,
  locale,
  days,
  type,
  href,
  base,
  range,
}: {
  rows: OverdueRowDto[];
  t: Dictionary;
  locale: Locale;
  days: (typeof DAY_FILTERS)[number];
  type: string;
  href: (changes: Record<string, string>) => string;
  base: string;
  range: ReportRange;
}) {
  const r = t.admin.reports;
  const d = t.admin.dashboard;
  const min = days === "any" ? 0 : Number(days);
  const shown = rows.filter((o) => o.daysOverdue >= min && (!type || o.memberType === type)).sort((a, b) => b.daysOverdue - a.daysOverdue);
  const total = rows.reduce((sum, o) => sum + o.accruedFine, 0);
  const dueDate = (iso: string) => new Intl.DateTimeFormat(intl(locale), { day: "numeric", month: "long", timeZone: "Europe/Istanbul" }).format(new Date(iso));
  const mailto = (o: OverdueRowDto) => {
    const values = { name: o.memberName.split(/\s+/)[0], title: o.bookTitle, date: dueDate(o.dueAt), fine: formatMoney(o.accruedFine, locale) };
    return `mailto:${o.memberEmail}?subject=${encodeURIComponent(format(d.remindSubject, values))}&body=${encodeURIComponent(format(d.remindBody, values))}`;
  };
  const severity = (n: number) => (n >= 14 ? "bg-overdue-bg text-overdue" : n >= 7 ? "bg-ready-bg text-ready" : "bg-stone-bg text-stone");
  const TH = "eyebrow border-b border-ink px-3.5 pb-3 text-left text-[10px] font-medium whitespace-nowrap text-ink-muted";
  const TD = "border-b border-line px-3.5 py-3.5 align-middle";
  return (
    <section id="overdue" aria-labelledby="h-od" className="flex scroll-mt-8 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 id="h-od" className="m-0 font-serif text-[32px] font-normal">
            {r.overdueTitle}
          </h2>
          <span className="text-sm text-ink-muted">{format(r.overdueLine, { count: String(rows.length), amount: formatMoney(total, locale) })}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          <div role="group" aria-label={r.daysLabel} className="flex flex-wrap gap-1.5">
            {DAY_FILTERS.map((key) => (
              <Link
                key={key}
                href={`${href({ days: key })}#overdue`}
                aria-current={key === days ? "true" : undefined}
                className={`inline-flex h-9 items-center rounded-full border px-3.5 text-sm no-underline ${key === days ? "border-ink bg-ink text-paper" : "border-line text-ink hover:border-ink"}`}
              >
                {r.days[key]}
              </Link>
            ))}
          </div>
          <Form action={`${base}#overdue`} className="flex h-9.5 items-center gap-2 rounded-xs border border-line bg-paper-3 px-3 text-sm">
            {range !== "month" && <input type="hidden" name="range" value={range} />}
            {days !== "any" && <input type="hidden" name="days" value={days} />}
            <label htmlFor="od-type" className="eyebrow text-[9px] text-ink-muted">
              {r.memberType}
            </label>
            <AutoSubmitSelect id="od-type" name="type" defaultValue={type} className="border-0 bg-transparent text-sm text-ink outline-none">
              <option value="">{r.allTypes}</option>
              {MEMBER_TYPES.map((m) => (
                <option key={m} value={m}>
                  {t.auth.memberTypes[m]}
                </option>
              ))}
            </AutoSubmitSelect>
          </Form>
          <a href={`/${locale}/admin/reports/overdue.csv`} className="eyebrow inline-flex h-9.5 items-center gap-2 border border-ink px-3.5 text-[10px] text-ink no-underline hover:bg-ink hover:text-paper">
            <FileDown aria-hidden size={15} strokeWidth={1.5} />
            {r.exportCsv}
          </a>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="m-0 border-t border-ink pt-4 text-[15px] text-ink-muted">{r.noOverdue}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-200 border-collapse text-[15px]">
            <thead>
              <tr>
                <th className={TH}>{r.colMember}</th>
                <th className={TH}>{r.colBook}</th>
                <th className={TH}>{r.colDue}</th>
                <th className={`${TH} text-right`}>{r.colDays}</th>
                <th className={`${TH} text-right`}>{r.colFine}</th>
                <th className={TH}>
                  <span className="sr-only">{r.colActions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.loanId} className="hover:bg-paper-3">
                  <td className={TD}>
                    <Link href={`/${locale}/admin/members/${o.memberId}`} className="flex flex-col gap-px text-ink no-underline">
                      <span className="hover:underline">{o.memberName}</span>
                      <span className="text-[13px] text-ink-muted">{t.auth.memberTypes[o.memberType]}</span>
                    </Link>
                  </td>
                  <td className={`${TD} text-sm`}>
                    {o.bookTitle} · <span className="tabular-nums">{o.copyBarcode}</span>
                  </td>
                  <td className={`${TD} text-sm whitespace-nowrap text-ink-muted`}>{formatDay(o.dueAt, locale)}</td>
                  <td className={`${TD} text-right`}>
                    <span className={`inline-flex rounded-xs px-2.25 py-1 text-xs font-medium tabular-nums ${severity(o.daysOverdue)}`}>{o.daysOverdue}</span>
                  </td>
                  <td className={`${TD} text-right whitespace-nowrap tabular-nums`}>{formatMoney(o.accruedFine, locale)}</td>
                  <td className={`${TD} text-right`}>
                    <a href={mailto(o)} className="eyebrow inline-flex h-8 items-center border border-line px-3 text-[9px] text-ink no-underline hover:border-ink">
                      {r.remind}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <span className="mt-3 block text-sm text-ink-muted">{format(r.showing, { count: String(shown.length) })}</span>
        </div>
      )}
    </section>
  );
}
