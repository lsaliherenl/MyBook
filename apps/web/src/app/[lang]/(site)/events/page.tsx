import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, CalendarPlus } from "lucide-react";
import { EVENT_KINDS, type EventDto, type EventKind } from "@mybook/shared";
import type { Locale } from "@/i18n/config";
import { format, getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { getEvents } from "@/lib/catalog";
import { dateBlock, seatsLeft, seatsLine, timeRange } from "@/lib/event-format";
import { ALL_EVENTS_ICON, EVENT_ICONS } from "@/lib/event-icons";
import { formatDay, formatShortDate, formatTime, localized } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.events.title, description: t.events.intro };
}

export default async function EventsPage({ searchParams }: PageProps<"/[lang]/events">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Events searchParams={searchParams} t={t} locale={locale} />
    </Suspense>
  );
}

async function Events({ searchParams, t, locale }: { searchParams: PageProps<"/[lang]/events">["searchParams"]; t: Dictionary; locale: Locale }) {
  const kindParam = String((await searchParams).kind ?? "");
  const kind = (EVENT_KINDS as readonly string[]).includes(kindParam) ? (kindParam as EventKind) : null;
  const [upcoming, past] = await Promise.all([getEvents("upcoming", 30), getEvents("past", 3)]);
  const e = t.events;
  const list = kind ? upcoming.filter((x) => x.kind === kind) : upcoming;
  const featured = upcoming.find((x) => x.kind === "BOOK_CLUB" && x.rsvpRequired) ?? upcoming.find((x) => x.rsvpRequired);
  const year = new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Europe/Istanbul" }).format(new Date(upcoming[0]?.startsAt ?? past[0]?.startsAt ?? "2026-10-01"));

  return (
    <>
      <section className="container-page flex flex-col gap-7 pt-10 pb-8 sm:pt-14 sm:pb-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-3.5">
            <span className="eyebrow text-plum-500">{format(e.eyebrow, { year })}</span>
            <h1 className="m-0 font-serif text-[60px] leading-[.92] font-light sm:text-[clamp(60px,7vw,104px)]">{e.title}</h1>
          </div>
          <p className="m-0 max-w-105 text-[17px] leading-relaxed font-light text-ink-muted">{e.intro}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div role="group" aria-label={e.filter} className="flex flex-wrap gap-2">
            {[null, ...EVENT_KINDS].map((k) => {
              const on = k === kind;
              const Icon = k ? EVENT_ICONS[k][0] : ALL_EVENTS_ICON;
              return (
                <Link
                  key={k ?? "all"}
                  href={k ? `?kind=${k}` : "?"}
                  scroll={false}
                  aria-current={on ? "true" : undefined}
                  className={`group inline-flex h-10 items-center border px-4 text-sm no-underline ${on ? "border-ink bg-ink text-paper" : "border-line text-ink hover:border-ink"}`}
                >
                  <span className={`inline-flex overflow-hidden transition-[max-width,margin] duration-350 ease-out-soft ${on ? "mr-2 max-w-6" : "max-w-0 group-hover:mr-2 group-hover:max-w-6"}`}>
                    <Icon aria-hidden size={16} strokeWidth={1.5} />
                  </span>
                  {k ? e.kindsPlural[k] : e.all}
                </Link>
              );
            })}
          </div>
          <a href={`/${locale}/events/calendar.ics`} className="eyebrow inline-flex items-center gap-2 text-[11px] text-ink no-underline hover:text-plum-500">
            <CalendarPlus aria-hidden size={16} strokeWidth={1.5} />
            {e.subscribe}
          </a>
        </div>
      </section>

      {featured && !kind && <FeaturedBand event={featured} t={t} locale={locale} />}

      <section aria-labelledby="h-coming" className="container-page pt-16 pb-10 sm:pt-22">
        <div className="mb-7 flex items-baseline justify-between">
          <h2 id="h-coming" className="m-0 font-serif text-[36px] font-normal sm:text-[44px]">
            {e.comingUp}
          </h2>
          <span className="text-sm text-ink-muted">{list.length === 1 ? e.datesOne : format(e.dates, { count: String(list.length) })}</span>
        </div>
        <ol key={kind ?? "all"} className="m-0 animate-swap list-none border-t border-ink p-0">
          {list.map((event) => (
            <EventRow key={event.id} event={event} t={t} locale={locale} />
          ))}
        </ol>
        {list.length === 0 && <p className="m-0 border-b border-line py-12 text-center font-serif text-[26px] text-ink-muted">{e.empty}</p>}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="h-past" className="container-page pt-12 pb-24 sm:pb-28">
          <h2 id="h-past" className="m-0 mb-7 font-serif text-[32px] font-normal sm:text-[36px]">
            {e.recently}
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {past.map((event) => (
              <Link key={event.id} href={`/${locale}/events/${event.slug}`} className="flex flex-col gap-2.5 bg-paper-2 p-6 text-ink no-underline transition-colors hover:bg-loan-bg/60">
                <span className="eyebrow text-[10px] text-ink-muted">
                  {formatShortDate(event.startsAt, locale)} · {e.kinds[event.kind]}
                </span>
                <span className="font-serif text-2xl leading-[1.15]">{localized(event, "title", locale)}</span>
                {localized(event, "description", locale) && <span className="text-[13px] text-ink-muted">{localized(event, "description", locale)}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function EventRow({ event, t, locale }: { event: EventDto; t: Dictionary; locale: Locale }) {
  const e = t.events;
  const { weekday, day, month } = dateBlock(event.startsAt, locale);
  const seats = seatsLine(event, e);
  const left = seatsLeft(event);
  const full = left === 0;
  const href = `/${locale}/events/${event.slug}`;
  const notice = event.kind === "NOTICE";
  return (
    <li
      className={`group grid grid-cols-[64px_minmax(0,1fr)] items-center gap-x-4 gap-y-2.5 border-b border-line py-7 transition-[background-color] duration-350 hover:bg-linear-to-r hover:from-loan-bg/55 hover:to-transparent md:grid-cols-[120px_minmax(0,1fr)_200px_180px] md:gap-8 ${notice ? "bg-paper-2 md:px-5" : ""}`}
    >
      <div className="row-span-3 flex flex-col gap-0.5 self-start md:row-span-1 md:self-center">
        <span className="eyebrow text-[10px] text-plum-500">{weekday}</span>
        <span className="font-serif text-[44px] leading-[.9] font-light md:text-[56px]">{day}</span>
        <span className="eyebrow text-[10px] text-ink-muted">{month}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <span className="flex min-h-4.5 items-center gap-3">
          <span className="eyebrow text-[10px] text-ink-muted">{e.kinds[event.kind]}</span>
          <span className="hover-icons inline-flex gap-2 text-plum-500">
            {EVENT_ICONS[event.kind].map((Icon, i) => (
              <Icon key={i} aria-hidden size={18} strokeWidth={1.5} />
            ))}
          </span>
        </span>
        <Link href={href} className="font-serif text-[26px] leading-[1.1] text-ink no-underline group-hover:italic md:text-[30px]">
          {localized(event, "title", locale)}
        </Link>
        <span className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-muted">
          <span>{timeRange(event, locale)}</span>
          <span>{localized(event, "location", locale)}</span>
        </span>
      </div>
      <span className={`text-sm ${seats.tone}`}>{seats.text}</span>
      {event.rsvpRequired ? (
        <Link
          href={href}
          className={`eyebrow inline-flex h-11.5 items-center justify-center justify-self-start border px-5 text-[10.5px] whitespace-nowrap no-underline md:justify-self-end ${
            full ? "border-ink text-ink hover:bg-ink hover:text-paper" : "border-plum-700 bg-plum-700 text-paper hover:bg-plum-900"
          }`}
        >
          {full ? e.joinWaitlist : e.rsvp}
        </Link>
      ) : (
        <span className="text-[13px] text-ink-muted md:justify-self-end">{e.noRsvp}</span>
      )}
    </li>
  );
}

function FeaturedBand({ event, t, locale }: { event: EventDto; t: Dictionary; locale: Locale }) {
  const e = t.events;
  const title = localized(event, "title", locale);
  const split = title.indexOf(": ");
  const seats = seatsLine(event, e);
  return (
    <section aria-labelledby="h-featured" className="flex flex-wrap">
      <div className="relative min-h-75 flex-[1_1_560px] overflow-hidden bg-[#4A3020] sm:min-h-125">
        <Image src={event.imageUrl ?? "/images/events-bookclub.jpg"} alt={e.imageAlt} fill sizes="(max-width: 1000px) 100vw, 50vw" className="animate-zoom object-cover object-[center_55%]" />
      </div>
      <div className="flex flex-[1_1_440px] flex-col justify-center gap-5 bg-plum-700 px-5 py-12 text-cream sm:p-[clamp(44px,5.5vw,80px)]">
        <span className="eyebrow text-[#D8C2CF]">{format(e.featured, { kind: e.kinds[event.kind] })}</span>
        <h2 id="h-featured" className="m-0 font-serif text-[40px] leading-[1.04] font-normal sm:text-[clamp(40px,3.8vw,54px)]">
          {split > 0 ? (
            <>
              {title.slice(0, split + 1)}
              <br />
              <span className="[hyphens:auto]">{title.slice(split + 2)}</span>
            </>
          ) : (
            title
          )}
        </h2>
        {localized(event, "description", locale) && <p className="m-0 max-w-105 text-[17px] leading-relaxed text-[#E3D3DB]">{localized(event, "description", locale)}</p>}
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow text-[13px]">
            {formatDay(event.startsAt, locale)} · {formatTime(event.startsAt, locale)}
          </span>
          <span className="text-[15px] text-[#D8C2CF]">
            {localized(event, "location", locale)}
            {seats.text && ` · ${seats.text}`}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-6">
          <Link href={`/${locale}/events/${event.slug}`} className="eyebrow group inline-flex h-12.5 items-center gap-3.5 bg-[#F3ECE2] px-6 text-xs text-ink no-underline hover:bg-paper-3">
            {e.rsvp}
            <ArrowRight aria-hidden size={16} strokeWidth={1.5} className="transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href={`/${locale}/events/${event.slug}`} className="eyebrow text-cream underline decoration-cream/40 underline-offset-6 hover:decoration-cream">
            {e.details}
          </Link>
        </div>
      </div>
    </section>
  );
}
