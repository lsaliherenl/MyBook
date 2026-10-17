import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BellRing, BookOpen, CircleAlert, Package, RotateCcw, ScanBarcode, Sparkles, TriangleAlert, Undo2, UserPlus } from "lucide-react";
import type { DashboardDto, DeskPickupDto, DeskTodayDto, OverdueRowDto, ProfileDto } from "@mybook/shared";
import { AdminSearch } from "@/components/admin/admin-search";
import { AdminTopBar } from "@/components/admin/admin-top-bar";
import { FormMessage } from "@/components/form";
import type { Locale } from "@/i18n/config";
import { format, getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { api } from "@/lib/api";
import { formatMoney, formatNumber, formatTime } from "@/lib/format";
import { getStaff } from "@/lib/staff";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.admin.dashboard.title };
}

/** B13: the librarian's start page — today's numbers, the week's loans, what needs a hand, pickups and overdue loans. */
export default async function DashboardPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard t={t} locale={locale} />
    </Suspense>
  );
}

const TIME_ZONE = "Europe/Istanbul";
const intl = (locale: Locale) => (locale === "tr" ? "tr-TR" : "en-US");

async function Dashboard({ t, locale }: { t: Dictionary; locale: Locale }) {
  const staff = await getStaff();
  let data: [DashboardDto, DeskTodayDto, OverdueRowDto[]];
  try {
    data = await Promise.all([
      api<DashboardDto>("/admin/reports/dashboard", { auth: true }),
      api<DeskTodayDto>("/admin/desk/today", { auth: true }),
      api<OverdueRowDto[]>("/admin/reports/overdue", { auth: true }),
    ]);
  } catch {
    return (
      <>
        <TopBar t={t} locale={locale} staff={staff} />
        <div className="p-10">
          <FormMessage tone="error">{t.admin.apiUnavailable}</FormMessage>
        </div>
      </>
    );
  }
  const [dashboard, today, overdue] = data;
  const d = t.admin.dashboard;
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TIME_ZONE }).format(now));
  const greeting = hour < 12 ? d.greetingMorning : hour < 18 ? d.greetingAfternoon : d.greetingEvening;
  const dateLine = new Intl.DateTimeFormat(intl(locale), { weekday: "long", day: "numeric", month: "long", timeZone: TIME_ZONE }).format(now);
  const base = `/${locale}/admin`;

  return (
    <>
      <TopBar t={t} locale={locale} staff={staff} />
      <main className="flex flex-col gap-8 px-3.5 py-10 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex flex-col gap-2">
            <span className="eyebrow text-plum-500">{dateLine}</span>
            <h1 className="m-0 animate-rise font-serif text-[40px] leading-none font-light sm:text-[56px]">{format(greeting, { name: staff.fullName.split(/\s+/)[0] })}</h1>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link href={`${base}/desk`} className="eyebrow inline-flex h-12 items-center gap-2.5 bg-plum-700 px-5 text-[11px] text-paper no-underline hover:bg-plum-900">
              <ScanBarcode aria-hidden size={16} strokeWidth={1.5} />
              {d.checkOut}
            </Link>
            <Link
              href={`${base}/desk?mode=return`}
              className="group eyebrow inline-flex h-12 items-center gap-2.5 border border-ink px-5 text-[11px] text-ink no-underline hover:bg-ink hover:text-paper"
            >
              <Undo2 aria-hidden size={16} strokeWidth={1.5} className="group-hover:animate-icon-tilt" />
              {d.return}
            </Link>
          </div>
        </div>

        <Kpis t={t} locale={locale} dashboard={dashboard} />

        <div className="flex flex-wrap gap-5">
          <WeekChart t={t} locale={locale} week={dashboard.week} now={now} />
          <Attention t={t} locale={locale} dashboard={dashboard} />
        </div>

        <div className="flex flex-wrap gap-5">
          <Pickups t={t} locale={locale} pickups={today.pickups} now={now} />
          <MostOverdue t={t} locale={locale} rows={overdue.slice(0, 5)} />
        </div>
      </main>
    </>
  );
}

function TopBar({ t, locale, staff }: { t: Dictionary; locale: Locale; staff: ProfileDto }) {
  return (
    <AdminTopBar staff={{ name: staff.fullName, role: t.admin.roles[staff.role] }} languageLabel={t.nav.language}>
      <AdminSearch action={`/${locale}/admin/desk`} label={t.admin.search} placeholder={t.admin.searchPlaceholder} />
    </AdminTopBar>
  );
}

// ─── KPI cards ───────────────────────────────────────────────────────────────

function Kpis({ t, locale, dashboard }: { t: Dictionary; locale: Locale; dashboard: DashboardDto }) {
  const d = t.admin.dashboard;
  const base = `/${locale}/admin`;
  const before = dashboard.activeLoansWeekAgo;
  const pct = before > 0 ? Math.round(((dashboard.activeLoans - before) / before) * 100) : 0;
  const trend = pct > 0 ? format(d.trendUp, { pct: String(pct) }) : pct < 0 ? format(d.trendDown, { pct: String(-pct) }) : d.trendFlat;
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 min-[1180px]:grid-cols-4">
      <Kpi label={d.kpiActive} value={formatNumber(dashboard.activeLoans, locale)} icons={[BookOpen, RotateCcw]}>
        <span className={pct >= 0 ? "text-available" : "text-overdue"}>{trend}</span>
      </Kpi>
      <Kpi label={d.kpiOverdue} value={formatNumber(dashboard.overdueLoans, locale)} icons={[CircleAlert, TriangleAlert]} accent="overdue" href={`${base}#overdue`}>
        <span className="text-ink-muted">{format(d.openFines, { amount: formatMoney(dashboard.unpaidFinesTotal, locale) })}</span>
      </Kpi>
      <Kpi label={d.kpiPickup} value={formatNumber(dashboard.awaitingPickup, locale)} icons={[Package, BellRing]} accent="gold" href={`${base}/desk`}>
        <span className="text-ready">
          {dashboard.expiringToday ? format(d.expireToday, { count: String(dashboard.expiringToday) }) : d.noneExpireToday}
        </span>
      </Kpi>
      <Kpi label={d.kpiMembers} value={formatNumber(dashboard.newMembersThisWeek, locale)} icons={[UserPlus, Sparkles]}>
        <span className="text-ink-muted">{d.membersNote}</span>
      </Kpi>
    </div>
  );
}

function Kpi({
  label,
  value,
  icons,
  accent,
  href,
  children,
}: {
  label: string;
  value: string;
  icons: React.ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>[];
  accent?: "overdue" | "gold";
  href?: string;
  children: React.ReactNode;
}) {
  const border = accent === "overdue" ? "border-t-3 border-t-overdue" : accent === "gold" ? "border-t-3 border-t-gold" : "";
  const body = (
    <>
      <span className="hover-icons absolute top-5 right-5 inline-flex gap-2.5 text-plum-500">
        {icons.map((Icon, i) => (
          <Icon key={i} aria-hidden size={22} strokeWidth={1.5} />
        ))}
      </span>
      <span className="eyebrow text-[10px] text-ink-muted">{label}</span>
      <span className={`font-serif text-[52px] leading-none tabular-nums ${accent === "overdue" ? "text-overdue" : ""}`}>{value}</span>
      <span className="text-[13px]">{children}</span>
    </>
  );
  const className = `group relative flex flex-col gap-2.5 border border-line bg-paper-3 p-6 text-ink no-underline ${border}`;
  return href ? (
    <Link href={href} className={`${className} hover:border-plum-500`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

// ─── Loans this week ─────────────────────────────────────────────────────────

/** Rounds the chart's top line up to 3 × a "nice" step (1, 2 or 5 × 10ⁿ), so the grid reads 0 / 100 / 200 / 300. */
function chartScale(max: number): number {
  const raw = Math.max(1, max) / 3;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  // Whole books only: a quiet week still reads 0 / 1 / 2 / 3.
  return Math.max(1, Math.ceil(step)) * 3;
}

function WeekChart({ t, locale, week, now }: { t: Dictionary; locale: Locale; week: DashboardDto["week"]; now: Date }) {
  const d = t.admin.dashboard;
  const todayDate = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
  const top = chartScale(Math.max(...week.map((w) => w.checkouts)));
  const [plotTop, plotBottom] = [20, 215];
  const y = (value: number) => plotBottom - (value / top) * (plotBottom - plotTop);
  const dayName = (date: string) => new Intl.DateTimeFormat(intl(locale), { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  const totals = week.reduce((sum, w) => ({ out: sum.out + w.checkouts, in: sum.in + w.returns }), { out: 0, in: 0 });
  const summary = week
    .filter((w) => w.date <= todayDate)
    .map((w) => `${dayName(w.date)} ${w.checkouts}`)
    .join(", ");

  return (
    <section aria-labelledby="h-week" className="flex min-w-0 flex-[3_1_520px] flex-col gap-4 border border-line bg-paper-3 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="h-week" className="m-0 font-serif text-[26px] font-normal">
          {d.weekTitle}
        </h2>
        <span className="text-[13px] text-ink-muted">
          {format(d.weekTotals, { out: formatNumber(totals.out, locale), in: formatNumber(totals.in, locale) })}
        </span>
      </div>
      <svg viewBox="0 0 560 240" width="100%" role="img" aria-label={format(d.chartLabel, { days: summary })} className="font-sans">
        <g stroke="var(--color-line)" strokeWidth="1">
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1="40" x2="560" y1={plotTop + i * 65} y2={plotTop + i * 65} />
          ))}
        </g>
        <g fontSize="12" fill="var(--color-ink-muted)">
          {[3, 2, 1, 0].map((i, row) => (
            <text key={i} x="0" y={plotTop + 4 + row * 65}>
              {formatNumber((top / 3) * i, locale)}
            </text>
          ))}
        </g>
        {week.map((w, i) => {
          const x = 62 + i * 72;
          const isToday = w.date === todayDate;
          const isSunday = i === 6;
          const future = w.date > todayDate;
          return (
            <g key={w.date}>
              {!future && w.checkouts > 0 && (
                <rect x={x} y={y(w.checkouts)} width="44" height={plotBottom - y(w.checkouts)} fill={isToday ? "var(--color-plum-500)" : "var(--color-plum-700)"}>
                  <title>{`${dayName(w.date)}: ${w.checkouts} / ${w.returns}`}</title>
                </rect>
              )}
              {isToday && (
                <text x={x + 22} y={y(w.checkouts) - 8} fontSize="12" fill="var(--color-ink)" textAnchor="middle">
                  {w.checkouts}
                </text>
              )}
              {isSunday && w.checkouts === 0 && (
                <text x={x + 22} y="208" fontSize="11" fill="var(--color-ink-muted)" textAnchor="middle">
                  {d.closed}
                </text>
              )}
              <text
                x={x + 22}
                y="234"
                fontSize="12"
                textAnchor="middle"
                fill={isToday ? "var(--color-ink)" : "var(--color-ink-muted)"}
                fontWeight={isToday ? 500 : undefined}
              >
                {isToday ? d.today : dayName(w.date)}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

// ─── Needs attention ─────────────────────────────────────────────────────────

function Attention({ t, locale, dashboard }: { t: Dictionary; locale: Locale; dashboard: DashboardDto }) {
  const d = t.admin.dashboard;
  const items: { key: string; dot: string; title: string; note: string; href: string }[] = [];
  if (dashboard.expiringToday > 0) {
    items.push({
      key: "expiring",
      dot: "bg-gold",
      title: format(d.expiringTonight, { count: String(dashboard.expiringToday) }),
      note: d.expiringNote,
      href: `/${locale}/admin/desk`,
    });
  }
  const over = dashboard.membersOverLimit;
  if (over.count > 0) {
    items.push({
      key: "fines",
      dot: "bg-overdue",
      title: format(d.overLimit, { count: String(over.count), limit: formatMoney(over.limit, locale) }),
      note: [d.overLimitNote, over.names.join(", ")].filter(Boolean).join(" · "),
      href: `/${locale}/admin#overdue`,
    });
  }
  const waitlist = dashboard.longestWaitlist;
  if (waitlist && waitlist.waiting >= 2) {
    items.push({
      key: "waitlist",
      dot: "bg-plum-500",
      title: format(d.waitlist, { title: waitlist.title, count: String(waitlist.waiting) }),
      note: d.waitlistNote,
      href: `/${locale}/books/${waitlist.slug}`,
    });
  }
  if (dashboard.longOverdue > 0) {
    items.push({
      key: "overdue",
      dot: "bg-line",
      title: format(d.longOverdue, { count: String(dashboard.longOverdue) }),
      note: d.longOverdueNote,
      href: `/${locale}/admin#overdue`,
    });
  }

  return (
    <section aria-labelledby="h-alerts" className="flex min-w-0 flex-[2_1_300px] flex-col gap-3.5 border border-line bg-paper-3 p-6">
      <h2 id="h-alerts" className="m-0 font-serif text-[26px] font-normal">
        {d.attention}
      </h2>
      {items.length === 0 && <p className="m-0 border-t border-line pt-3 text-[15px] text-ink-muted">{d.allClear}</p>}
      {items.map((item) => (
        <Link key={item.key} href={item.href} className="group flex gap-3 border-t border-line py-3 text-ink no-underline">
          <span aria-hidden className={`mt-1.75 size-2 flex-none rounded-full ${item.dot}`} />
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px] group-hover:underline group-hover:underline-offset-4">{item.title}</span>
            <span className="text-[13px] text-ink-muted">{item.note}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}

// ─── Today's pickups ─────────────────────────────────────────────────────────

const TH = "eyebrow border-b border-line py-3 text-left text-[9.5px] font-medium text-ink-muted";
const TD = "border-b border-line";

function pickupBadge(p: DeskPickupDto, t: Dictionary, locale: Locale, endOfDay: number) {
  const d = t.admin.dashboard;
  if (p.status === "COLLECTED") return { text: format(d.statusCollected, { time: formatTime(p.collectedAt!, locale) }), className: "bg-available-bg text-available" };
  if (p.expiresAt && new Date(p.expiresAt).getTime() < endOfDay) {
    return { text: format(d.statusExpires, { time: formatTime(p.expiresAt, locale) }), className: "bg-overdue-bg text-overdue" };
  }
  return { text: d.statusReady, className: "bg-ready-bg text-ready" };
}

function Pickups({ t, locale, pickups, now }: { t: Dictionary; locale: Locale; pickups: DeskPickupDto[]; now: Date }) {
  const d = t.admin.dashboard;
  // End of today in Istanbul (UTC+3 all year).
  const offset = 3 * 60 * 60 * 1000;
  const endOfDay = Math.floor((now.getTime() + offset) / 86_400_000) * 86_400_000 + 86_400_000 - offset;
  return (
    <section aria-labelledby="h-pick" className="min-w-0 flex-[1_1_460px] border border-line bg-paper-3">
      <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4.5">
        <h2 id="h-pick" className="m-0 font-serif text-[26px] font-normal">
          {d.pickupsTitle}
        </h2>
        <Link href={`/${locale}/admin/desk`} className="eyebrow text-[10px] text-ink no-underline hover:text-plum-500">
          {d.openDesk}
        </Link>
      </div>
      {pickups.length === 0 ? (
        <p className="m-0 px-6 py-5 text-[15px] text-ink-muted">{d.noPickups}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={`${TH} px-6`}>{d.colCode}</th>
                <th className={`${TH} px-2`}>{d.colMember}</th>
                <th className={`${TH} px-2`}>{d.colBooks}</th>
                <th className={`${TH} px-6`}>{d.colStatus}</th>
              </tr>
            </thead>
            <tbody>
              {pickups.slice(0, 6).map((p) => {
                const badge = pickupBadge(p, t, locale, endOfDay);
                return (
                  <tr key={`${p.code}:${p.memberId}`} className="hover:bg-paper-2/50">
                    <td className={`${TD} px-6 py-3.25 font-medium tracking-[.05em]`}>
                      <Link href={`/${locale}/admin/desk?member=${p.memberId}`} className="text-ink no-underline hover:underline">
                        {p.code}
                      </Link>
                    </td>
                    <td className={`${TD} px-2 py-3.25`}>{p.memberName}</td>
                    <td className={`${TD} px-2 py-3.25 text-ink-muted`}>
                      {p.books.length === 1 ? p.books[0] : format(d.booksCount, { count: String(p.books.length) })}
                    </td>
                    <td className={`${TD} px-6 py-3.25`}>
                      <span className={`eyebrow px-1.75 py-1 text-[9px] whitespace-nowrap ${badge.className}`}>{badge.text}</span>
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

// ─── Most overdue ────────────────────────────────────────────────────────────

function MostOverdue({ t, locale, rows }: { t: Dictionary; locale: Locale; rows: OverdueRowDto[] }) {
  const d = t.admin.dashboard;
  const dueDate = (iso: string) => new Intl.DateTimeFormat(intl(locale), { day: "numeric", month: "long", timeZone: TIME_ZONE }).format(new Date(iso));
  const mailto = (row: OverdueRowDto) => {
    const values = { name: row.memberName.split(/\s+/)[0], title: row.bookTitle, date: dueDate(row.dueAt), fine: formatMoney(row.accruedFine, locale) };
    const subject = encodeURIComponent(format(d.remindSubject, values));
    const body = encodeURIComponent(format(d.remindBody, values));
    return `mailto:${row.memberEmail}?subject=${subject}&body=${body}`;
  };
  return (
    <section id="overdue" aria-labelledby="h-over" className="min-w-0 flex-[1_1_400px] scroll-mt-20 border border-line bg-paper-3">
      <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4.5">
        <h2 id="h-over" className="m-0 font-serif text-[26px] font-normal">
          {d.overdueTitle}
        </h2>
        {rows.length > 0 && (
          <a href={`/${locale}/admin/reports/overdue.csv`} className="eyebrow text-[10px] text-ink no-underline hover:text-plum-500">
            {d.downloadCsv}
          </a>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="m-0 px-6 py-5 text-[15px] text-ink-muted">{d.noOverdue}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={`${TH} px-6`}>{d.colMemberBook}</th>
                <th className={`${TH} px-2 text-right`}>{d.colDays}</th>
                <th className={`${TH} px-2 text-right`}>{d.colFine}</th>
                <th className={`${TH} px-6`}>
                  <span className="sr-only">{d.colAction}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.loanId} className="hover:bg-paper-2/50">
                  <td className={`${TD} px-6 py-3`}>
                    <span className="flex flex-col gap-0.5">
                      <Link href={`/${locale}/admin/desk?member=${row.memberId}`} className="text-ink no-underline hover:underline">
                        {row.memberName}
                      </Link>
                      <span className="text-xs text-ink-muted">
                        {row.bookTitle} · {row.copyBarcode}
                      </span>
                    </span>
                  </td>
                  <td className={`${TD} px-2 py-3 text-right text-overdue tabular-nums`}>{row.daysOverdue}</td>
                  <td className={`${TD} px-2 py-3 text-right tabular-nums`}>{formatMoney(row.accruedFine, locale)}</td>
                  <td className={`${TD} px-6 py-3 text-right`}>
                    <a href={mailto(row)} className="eyebrow inline-flex h-8 items-center border border-line px-2.5 text-[9px] text-ink no-underline hover:border-ink">
                      {d.remind}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-8 px-3.5 py-10 sm:px-10">
      <div className="h-11 max-w-130 animate-pulse bg-paper-2" />
      <div className="h-14 w-2/3 animate-pulse bg-paper-2" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 min-[1180px]:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-40 animate-pulse bg-paper-2" />
        ))}
      </div>
      <div className="h-80 animate-pulse bg-paper-2" />
    </div>
  );
}
