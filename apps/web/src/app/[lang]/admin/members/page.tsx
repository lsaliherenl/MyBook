import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, FileDown, Search } from "lucide-react";
import { ADMIN_MEMBER_FILTERS, type AdminMemberFilter, type AdminMemberListDto, type AdminMemberRowDto } from "@mybook/shared";
import { AdminSearch } from "@/components/admin/admin-search";
import { AdminTopBar } from "@/components/admin/admin-top-bar";
import { FormMessage } from "@/components/form";
import type { Locale } from "@/i18n/config";
import { format, getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { api } from "@/lib/api";
import { formatMoney, formatNumber, formatShortDate, initials } from "@/lib/format";
import { getStaff } from "@/lib/staff";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.admin.members.title };
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
const AVATARS = ["bg-plum-700", "bg-[#55684f]", "bg-[#8e4a36]", "bg-plum-500", "bg-[#241b21]", "bg-gold"];
const avatarFor = (id: string) => AVATARS[parseInt(id.replace(/-/g, "").slice(-4), 16) % AVATARS.length];

/** B17: everyone with a library account — who is borrowing, who is late, who is blocked. */
export default async function MembersPage({ searchParams }: PageProps<"/[lang]/admin/members">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div aria-hidden className="m-10 h-96 animate-pulse bg-paper-2" />}>
      <Members t={t} locale={locale} searchParams={searchParams} />
    </Suspense>
  );
}

async function Members({ t, locale, searchParams }: { t: Dictionary; locale: Locale; searchParams: Promise<Params> }) {
  const params = await searchParams;
  const m = t.admin.members;
  const q = one(params.q);
  const filter = (ADMIN_MEMBER_FILTERS as readonly string[]).includes(one(params.filter)) ? (one(params.filter) as AdminMemberFilter) : "all";
  const page = Math.max(1, Number(one(params.page)) || 1);
  const query = new URLSearchParams({ filter, page: String(page), pageSize: "25" });
  if (q) query.set("q", q);
  const [staff, list] = await Promise.all([getStaff(), api<AdminMemberListDto>(`/admin/members?${query}`, { auth: true }).catch(() => null)]);

  const base = `/${locale}/admin/members`;
  const href = (changes: Record<string, string | number>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ q, filter, page: "", ...changes })) if (value && !(key === "filter" && value === "all")) next.set(key, String(value));
    return next.size ? `${base}?${next}` : base;
  };
  const exportQuery = new URLSearchParams({ filter });
  if (q) exportQuery.set("q", q);

  return (
    <>
      <AdminTopBar staff={{ name: staff.fullName, role: t.admin.roles[staff.role] }} languageLabel={t.nav.language}>
        <AdminSearch action={`/${locale}/admin/desk`} label={t.admin.search} placeholder={t.admin.searchPlaceholder} />
      </AdminTopBar>
      <main className="flex flex-col gap-7 px-3.5 py-10 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex flex-col gap-2">
            <span className="eyebrow text-[10px] text-plum-500">{m.eyebrow}</span>
            <h1 className="m-0 animate-rise font-serif text-[44px] leading-none font-light sm:text-[56px]">{m.title}</h1>
            <span className="text-[15px] text-ink-muted">{m.subtitle}</span>
          </div>
          <a href={`${base}/export.csv?${exportQuery}`} className="eyebrow inline-flex h-12 items-center gap-2.5 border border-ink px-5 text-[11px] text-ink no-underline hover:bg-ink hover:text-paper">
            <FileDown aria-hidden size={16} strokeWidth={1.5} />
            {m.exportCsv}
          </a>
        </div>

        {!list ? (
          <FormMessage tone="error">{t.admin.apiUnavailable}</FormMessage>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 min-[1180px]:grid-cols-4">
              <Kpi label={m.kpiMembers} value={formatNumber(list.kpis.members, locale)} note={format(m.kpiMembersNote, { count: formatNumber(list.kpis.newThisMonth, locale) })} />
              <Kpi
                label={m.kpiBorrowing}
                value={formatNumber(list.kpis.borrowing, locale)}
                note={format(m.kpiBorrowingNote, { pct: String(list.kpis.members ? Math.round((list.kpis.borrowing / list.kpis.members) * 100) : 0) })}
              />
              <Kpi label={m.kpiBlocked} value={formatNumber(list.kpis.blocked, locale)} note={m.kpiBlockedNote} tone="text-overdue" />
              <Kpi
                label={m.kpiOverdue}
                value={formatNumber(list.kpis.withOverdue, locale)}
                note={format(m.kpiOverdueNote, { limit: formatMoney(list.fineBlockThreshold, locale) })}
                tone="text-ready"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Form action={base} role="search" className="flex h-11.5 max-w-105 flex-[1_1_300px] items-center gap-3 rounded-xs border border-line bg-paper-3 px-3.5 focus-within:border-plum-500">
                {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
                <Search aria-hidden size={18} strokeWidth={1.5} className="flex-none text-ink-muted" />
                <label htmlFor="mb-q" className="sr-only">
                  {m.findLabel}
                </label>
                <input id="mb-q" name="q" type="search" defaultValue={q} placeholder={m.findPlaceholder} className="min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-none" />
              </Form>
              <div role="group" aria-label={m.chipsLabel} className="flex flex-wrap gap-2">
                {ADMIN_MEMBER_FILTERS.map((key) => {
                  const on = key === filter;
                  return (
                    <Link
                      key={key}
                      href={href({ filter: key })}
                      aria-current={on ? "true" : undefined}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm no-underline ${on ? "border-ink bg-ink text-paper" : "border-line text-ink hover:border-ink"}`}
                    >
                      {m.chips[key]} <span className="opacity-70">{formatNumber(list.counts[key], locale)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {list.items.length === 0 ? (
              <div className="flex flex-col items-center gap-2.5 border border-dashed border-line px-5 py-12 text-center">
                <span className="font-serif text-[30px]">{m.emptyTitle}</span>
                <span className="text-[15px] text-ink-muted">{m.emptyText}</span>
              </div>
            ) : (
              <MemberTable list={list} t={t} locale={locale} />
            )}

            <Pager list={list} text={m} locale={locale} href={href} />
          </>
        )}
      </main>
    </>
  );
}

function Kpi({ label, value, note, tone = "" }: { label: string; value: string; note: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-1.5 bg-paper-3 px-5.5 py-5">
      <span className="eyebrow text-[10px] text-ink-muted">{label}</span>
      <span className={`font-serif text-[40px] leading-none tabular-nums ${tone}`}>{value}</span>
      <span className="text-[13px] text-ink-muted">{note}</span>
    </div>
  );
}

const TH = "eyebrow border-b border-ink px-3.5 pb-3 text-left text-[10px] font-medium whitespace-nowrap text-ink-muted";
const TD = "border-b border-line px-3.5 py-3.5 align-middle";

function statusOf(row: AdminMemberRowDto, list: AdminMemberListDto): { key: keyof Dictionary["admin"]["members"]["statuses"]; className: string } {
  if (row.status === "BLOCKED") return { key: "blocked", className: "bg-overdue-bg text-overdue" };
  if (list.fineBlockThreshold > 0 && row.fines >= list.fineBlockThreshold * 0.6) return { key: "nearLimit", className: "bg-ready-bg text-ready" };
  if (row.role !== "MEMBER") return { key: "staff", className: "bg-loan-bg text-loan" };
  return { key: "active", className: "bg-available-bg text-available" };
}

function MemberTable({ list, t, locale }: { list: AdminMemberListDto; t: Dictionary; locale: Locale }) {
  const m = t.admin.members;
  return (
    <div className="-mt-1.5 overflow-x-auto">
      <table className="w-full min-w-235 border-collapse text-[15px]">
        <thead>
          <tr>
            <th className={TH}>{m.colMember}</th>
            <th className={TH}>{m.colType}</th>
            <th className={`${TH} text-right`}>{m.colLoans}</th>
            <th className={`${TH} text-right`}>{m.colOverdue}</th>
            <th className={`${TH} text-right`}>{m.colFines}</th>
            <th className={TH}>{m.colStatus}</th>
            <th className={TH}>{m.colLast}</th>
            <th className={TH}>
              <span className="sr-only">{m.colOpen}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {list.items.map((row) => {
            const status = statusOf(row, list);
            const href = `/${locale}/admin/members/${row.id}`;
            return (
              <tr key={row.id} className="hover:bg-paper-3">
                <td className={TD}>
                  <Link href={href} className="flex items-center gap-3.5 text-ink no-underline">
                    <span aria-hidden className={`inline-flex size-9.5 flex-none items-center justify-center rounded-full font-serif text-[15px] text-paper ${avatarFor(row.id)}`}>
                      {initials(row.fullName)}
                    </span>
                    <span className="flex flex-col gap-px">
                      <span className="text-[15px] font-medium hover:underline">{row.fullName}</span>
                      <span className="text-[13px] text-ink-muted tabular-nums">{row.studentNumber ?? row.cardNumber}</span>
                    </span>
                  </Link>
                </td>
                <td className={TD}>
                  <span className="flex flex-col gap-px">
                    <span className="text-sm">{t.auth.memberTypes[row.memberType]}</span>
                    <span className="text-[13px] text-ink-muted">{row.faculty ?? "—"}</span>
                  </span>
                </td>
                <td className={`${TD} text-right tabular-nums`}>
                  {row.activeLoans} / {list.maxActiveLoans}
                </td>
                <td className={`${TD} text-right tabular-nums ${row.overdueLoans ? "text-overdue" : "text-ink-muted"}`}>{row.overdueLoans || "—"}</td>
                <td className={`${TD} text-right whitespace-nowrap tabular-nums ${row.fines ? (row.status === "BLOCKED" ? "text-overdue" : "text-ink") : "text-ink-muted"}`}>
                  {formatMoney(row.fines, locale)}
                </td>
                <td className={TD}>
                  <span className={`eyebrow inline-flex rounded-xs px-2.25 py-1 text-[10px] whitespace-nowrap ${status.className}`}>{m.statuses[status.key]}</span>
                </td>
                <td className={`${TD} text-sm whitespace-nowrap text-ink-muted`}>{row.lastActivityAt ? formatShortDate(row.lastActivityAt, locale) : m.never}</td>
                <td className={`${TD} text-right`}>
                  <Link href={href} aria-label={format(m.open, { name: row.fullName })} className="inline-flex size-8.5 items-center justify-center text-ink hover:text-plum-500">
                    <ChevronRight aria-hidden size={18} strokeWidth={1.5} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Pager({
  list,
  text,
  locale,
  href,
}: {
  list: AdminMemberListDto;
  text: Dictionary["admin"]["members"];
  locale: Locale;
  href: (changes: Record<string, string | number>) => string;
}) {
  const from = list.total ? (list.page - 1) * list.pageSize + 1 : 0;
  const to = Math.min(list.total, list.page * list.pageSize);
  const button = "eyebrow inline-flex h-10 items-center border px-4 text-[10px] no-underline";
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <span className="text-sm text-ink-muted">
        {format(text.showing, { from: formatNumber(from, locale), to: formatNumber(to, locale), total: formatNumber(list.total, locale) })}
      </span>
      <div className="flex gap-1">
        {list.page > 1 ? (
          <Link href={href({ page: list.page - 1 })} className={`${button} border-ink text-ink`}>
            {text.previous}
          </Link>
        ) : (
          <span className={`${button} border-line text-ink-muted`}>{text.previous}</span>
        )}
        {to < list.total ? (
          <Link href={href({ page: list.page + 1 })} className={`${button} border-ink text-ink`}>
            {text.next}
          </Link>
        ) : (
          <span className={`${button} border-line text-ink-muted`}>{text.next}</span>
        )}
      </div>
    </div>
  );
}
