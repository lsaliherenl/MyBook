import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { ADMIN_EVENT_LISTS, type AdminEventDto, type AdminEventList, type AdminEventListDto, type EventAttendeeDto } from "@mybook/shared";
import { AdminSearch } from "@/components/admin/admin-search";
import { AdminTopBar } from "@/components/admin/admin-top-bar";
import { FormMessage } from "@/components/form";
import type { Locale } from "@/i18n/config";
import { format, getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { api } from "@/lib/api";
import { localized } from "@/lib/format";
import { getStaff } from "@/lib/staff";
import { EventEditor } from "./event-editor";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.admin.programme.title };
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const TIME_ZONE = "Europe/Istanbul";

/** B18: the programme — upcoming, drafts and past events on the left, the selected one in an editor on the right. */
export default async function EventsAdminPage({ searchParams }: PageProps<"/[lang]/admin/events">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div aria-hidden className="m-10 h-96 animate-pulse bg-paper-2" />}>
      <Programme t={t} locale={locale} searchParams={searchParams} />
    </Suspense>
  );
}

async function Programme({ t, locale, searchParams }: { t: Dictionary; locale: Locale; searchParams: Promise<Params> }) {
  const params = await searchParams;
  const p = t.admin.programme;
  const list = (ADMIN_EVENT_LISTS as readonly string[]).includes(one(params.list)) ? (one(params.list) as AdminEventList) : "upcoming";
  const selectedId = one(params.id);
  const isNew = one(params.new) === "1";

  const [staff, events] = await Promise.all([getStaff(), api<AdminEventListDto>(`/admin/events?list=${list}`, { auth: true }).catch(() => null)]);
  const selected: AdminEventDto | null = selectedId
    ? (events?.items.find((e) => e.id === selectedId) ?? (await api<AdminEventDto>(`/admin/events/${selectedId}`, { auth: true }).catch(() => null)))
    : null;
  const attendees = selected ? await api<EventAttendeeDto[]>(`/admin/events/${selected.id}/attendees`, { auth: true }).catch(() => []) : [];
  const base = `/${locale}/admin/events`;

  return (
    <>
      <AdminTopBar staff={{ name: staff.fullName, role: t.admin.roles[staff.role] }} languageLabel={t.nav.language}>
        <AdminSearch action={`/${locale}/admin/desk`} label={t.admin.search} placeholder={t.admin.searchPlaceholder} />
      </AdminTopBar>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-line px-3.5 pt-7 sm:px-10">
        <div className="flex flex-col gap-1.5 pb-4.5">
          <span className="eyebrow text-[10px] text-plum-500">{p.eyebrow}</span>
          <h1 className="m-0 animate-rise font-serif text-[40px] leading-none font-light sm:text-[48px]">{p.title}</h1>
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <nav aria-label={p.tabsLabel} className="flex gap-7">
            {ADMIN_EVENT_LISTS.map((key) => (
              <Link
                key={key}
                href={`${base}?list=${key}`}
                aria-current={key === list ? "page" : undefined}
                className={`-mb-px border-b-2 py-3.5 text-base no-underline ${key === list ? "border-plum-700 text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}
              >
                {p.tabs[key]} {events && <span className="text-[13px] text-ink-muted">{events.counts[key]}</span>}
              </Link>
            ))}
          </nav>
          <Link href={`${base}?list=drafts&new=1`} className="eyebrow mb-2.5 inline-flex h-11 items-center gap-2 bg-plum-700 px-4.5 text-[10px] text-paper no-underline hover:bg-plum-900">
            <Plus aria-hidden size={16} strokeWidth={1.5} />
            {p.newEvent}
          </Link>
        </div>
      </div>

      {!events ? (
        <div className="p-10">
          <FormMessage tone="error">{t.admin.apiUnavailable}</FormMessage>
        </div>
      ) : (
        <div className="flex flex-1 flex-wrap items-stretch">
          <main className="flex min-w-0 flex-[3_1_520px] flex-col px-3.5 pt-7 pb-12 sm:px-10">
            {events.items.length === 0 && <p className="m-0 py-12 text-[15px] text-ink-muted">{p.empty}</p>}
            {events.items.map((e) => (
              <EventRow key={e.id} event={e} t={t} locale={locale} list={list} on={e.id === selected?.id} href={`${base}?list=${list}&id=${e.id}`} />
            ))}
          </main>
          {(selected || isNew) && (
            <EventEditor
              key={selected?.id ?? "new"}
              event={selected}
              attendees={attendees}
              locale={locale}
              text={p}
              kinds={t.events.kinds}
              base={base}
              list={list}
            />
          )}
        </div>
      )}
    </>
  );
}

function parts(iso: string, locale: Locale) {
  const intl = locale === "tr" ? "tr-TR" : "en-US";
  const get = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intl, { ...opts, timeZone: TIME_ZONE }).format(new Date(iso));
  return {
    month: get({ month: "short" }),
    day: get({ day: "2-digit" }),
    weekday: get({ weekday: "short" }),
    time: get({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
    date: new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date(iso)),
  };
}

function EventRow({ event: e, t, locale, list, on, href }: { event: AdminEventDto; t: Dictionary; locale: Locale; list: AdminEventList; on: boolean; href: string }) {
  const p = t.admin.programme;
  const start = parts(e.startsAt, locale);
  const end = e.endsAt ? parts(e.endsAt, locale) : null;
  const full = e.capacity !== null && e.registered >= e.capacity;
  const status = list === "past" ? "past" : !e.published ? "draft" : full && e.rsvpRequired ? "full" : "published";
  const tone = { published: "bg-available-bg text-available", full: "bg-overdue-bg text-overdue", draft: "bg-stone-bg text-stone", past: "bg-paper-2 text-ink-muted" }[status];
  const rsvp = !e.rsvpRequired
    ? p.noRsvp
    : list === "past"
      ? format(p.attended, { count: String(e.registered) })
      : [
          e.capacity ? format(p.going, { going: String(e.registered), capacity: String(e.capacity) }) : format(p.goingOpen, { going: String(e.registered) }),
          e.waitlisted ? format(p.waiting, { count: String(e.waitlisted) }) : null,
        ]
          .filter(Boolean)
          .join(" · ");
  const fill = e.capacity ? Math.min(100, Math.round((e.registered / e.capacity) * 100)) : 0;
  return (
    <Link
      href={href}
      aria-current={on ? "true" : undefined}
      className={`flex items-center gap-5 border-b border-line py-4.5 pr-4 pl-3.25 text-ink no-underline ${on ? "border-l-3 border-l-plum-700 bg-paper-3" : "border-l-3 border-l-transparent hover:bg-paper-3/60"}`}
    >
      <span className="flex w-13.5 flex-none flex-col items-center">
        <span className="eyebrow text-[9px] text-ink-muted">{start.month}</span>
        <span className="font-serif text-[34px] leading-none">{start.day}</span>
        <span className="text-xs text-ink-muted">{start.weekday}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="eyebrow text-[9px] text-plum-500">{t.events.kinds[e.kind]}</span>
        <span className="font-serif text-[22px] leading-[1.15]">{localized(e, "title", locale)}</span>
        <span className="text-[13px] text-ink-muted">
          {end && end.date !== start.date ? `${start.day} ${start.month} – ${end.day} ${end.month}` : `${start.time}${end ? ` – ${end.time}` : ""}`} ·{" "}
          {localized(e, "location", locale)}
        </span>
      </span>
      <span className="flex w-37.5 flex-none flex-col items-end gap-1.5">
        <span className={`eyebrow rounded-xs px-2.25 py-1 text-[10px] ${tone}`}>{p.statuses[status]}</span>
        <span className="text-[13px] whitespace-nowrap text-ink-muted">{rsvp}</span>
        {e.rsvpRequired && e.capacity ? (
          <span aria-hidden className="h-1 w-30 bg-paper-2">
            <span className={`block h-full ${fill >= 100 ? "bg-overdue" : "bg-plum-700"}`} style={{ width: `${fill}%` }} />
          </span>
        ) : null}
      </span>
    </Link>
  );
}
