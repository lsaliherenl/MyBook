import type { Metadata } from "next";
import { Suspense } from "react";
import type { DeskActivityDto, DeskCopyDto, DeskMemberDto, DeskMemberMatchDto, DeskTodayDto } from "@mybook/shared";
import type { Locale } from "@/i18n/config";
import { format, getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { api } from "@/lib/api";
import { getRules } from "@/lib/catalog";
import { formatMoney, formatTime } from "@/lib/format";
import { getStaff } from "@/lib/staff";
import { DeskWorkspace } from "./desk-workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.admin.desk.title };
}

/**
 * B14. `?member=` opens a member (links from the dashboard), `?q=` comes from the top-bar search
 * (a copy barcode opens the return, anything else looks up the member), `?mode=return` starts on returns.
 */
export default async function DeskPage({ searchParams }: PageProps<"/[lang]/admin/desk">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div aria-hidden className="m-10 h-96 animate-pulse bg-paper-2" />}>
      <Desk t={t} locale={locale} searchParams={searchParams} />
    </Suspense>
  );
}

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value.trim() : "");
const get = <T,>(path: string) => api<T>(path, { auth: true }).catch(() => null);

async function Desk({ t, locale, searchParams }: { t: Dictionary; locale: Locale; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const [staff, rules] = await Promise.all([getStaff(), getRules()]);
  const memberId = one(params.member);
  const q = one(params.q);

  let mode: "checkout" | "return" = one(params.mode) === "return" ? "return" : "checkout";
  let member: DeskMemberDto | null = null;
  let matches: DeskMemberMatchDto[] | null = null;
  let copy: DeskCopyDto | null = null;

  if (memberId) {
    member = await get<DeskMemberDto>(`/admin/desk/members/${encodeURIComponent(memberId)}`);
    mode = "checkout";
  } else if (/^BK\d{3,}$/i.test(q)) {
    copy = await get<DeskCopyDto>(`/admin/desk/copies/${encodeURIComponent(q)}`);
    mode = "return";
  } else if (q.length >= 2) {
    matches = (await get<DeskMemberMatchDto[]>(`/admin/desk/lookup?q=${encodeURIComponent(q)}`)) ?? [];
    if (matches.length === 1) member = await get<DeskMemberDto>(`/admin/desk/members/${matches[0].id}`);
    mode = "checkout";
  }

  return (
    <DeskWorkspace
      // A new search or member link starts a fresh desk; refreshes after a checkout keep the state.
      key={`${memberId}|${q}|${one(params.mode)}`}
      text={{ desk: t.admin.desk, errors: t.admin.errors, memberTypes: t.auth.memberTypes, languageLabel: t.nav.language }}
      locale={locale}
      staff={{ name: staff.fullName, role: t.admin.roles[staff.role] }}
      canOverride={staff.role === "ADMIN"}
      loanDays={rules.loanDays}
      initialMode={mode}
      initialMember={member}
      initialMatches={matches}
      initialQuery={q}
      initialCopy={copy}
      side={
        <Suspense fallback={<div className="h-64 animate-pulse bg-paper-2" />}>
          <DeskSide t={t} locale={locale} />
        </Suspense>
      }
    />
  );
}

/** Right column: what waits on the hold shelf and the latest checkouts, returns and holds. */
async function DeskSide({ t, locale }: { t: Dictionary; locale: Locale }) {
  const d = t.admin.desk;
  const today = await get<DeskTodayDto>("/admin/desk/today");
  if (!today) return null;
  const waiting = today.pickups.filter((p) => p.status === "READY").length;

  const detail = (a: DeskActivityDto) =>
    a.kind === "out"
      ? `${a.memberName} · ${a.code ?? d.walkInDetail}`
      : a.kind === "hold"
        ? `${format(d.holdFor, { name: a.memberName })} · ${a.code}`
        : `${a.memberName} · ${a.fine ? formatMoney(a.fine, locale) : d.onTimeDetail}`;
  const kindColor = (a: DeskActivityDto) =>
    a.kind === "out" ? "text-plum-700" : a.kind === "hold" ? "text-ready" : a.fine ? "text-overdue" : "text-available";

  return (
    <>
      <div className="flex flex-col gap-1.5 bg-paper-2 p-5">
        <span className="eyebrow text-[10px] text-ink-muted">{d.waiting}</span>
        <span className="font-serif text-4xl leading-none">{format(d.pickupsN, { count: String(waiting) })}</span>
        <span className="text-[13px] text-ready">{today.expiringToday ? format(d.expireTonight, { count: String(today.expiringToday) }) : d.noneTonight}</span>
      </div>
      <h2 className="eyebrow m-0 mt-2 text-[10px] text-ink-muted">{d.recent}</h2>
      {today.recent.length === 0 ? (
        <p className="m-0 border-t border-line pt-3 text-sm text-ink-muted">{d.noActivity}</p>
      ) : (
        <ol className="m-0 list-none border-t border-line p-0">
          {today.recent.map((a) => (
            <li key={a.id} className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 border-b border-line py-3">
              <span className="text-[13px] text-ink-muted tabular-nums">{formatTime(a.at, locale)}</span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm">
                  <span className={`eyebrow text-[9px] ${kindColor(a)}`}>{d.kinds[a.kind]}</span> {a.bookTitle}
                </span>
                <span className="truncate text-xs text-ink-muted">{detail(a)}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
