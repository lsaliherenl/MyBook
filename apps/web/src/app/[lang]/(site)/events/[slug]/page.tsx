import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarDays, MapPin, Users } from "lucide-react";
import type { EventDetailDto, MyRsvpDto, ProfileDto } from "@mybook/shared";
import { BookCover } from "@/components/book-cover";
import { RsvpCard } from "@/components/events/rsvp-card";
import type { Locale } from "@/i18n/config";
import { format, getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { api } from "@/lib/api";
import { getEvent } from "@/lib/catalog";
import { longDay, timeRange } from "@/lib/event-format";
import { formatDay, formatShortDate, formatTime, localized } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[lang]/events/[slug]">): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getLocale()]);
  const event = await getEvent(slug);
  if (!event) return {};
  return { title: localized(event, "title", locale), description: localized(event, "description", locale) ?? undefined };
}

export default async function EventPage({ params }: PageProps<"/[lang]/events/[slug]">) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <EventView params={params} />
    </Suspense>
  );
}

const pick = (text: { tr: string; en: string } | undefined, locale: Locale) => text?.[locale] ?? "";

async function EventView({ params }: { params: PageProps<"/[lang]/events/[slug]">["params"] }) {
  const { slug } = await params;
  const [t, locale, event] = await Promise.all([getDictionary(), getLocale(), getEvent(slug)]);
  if (!event) notFound();
  const p = t.eventPage;
  const title = localized(event, "title", locale);
  const split = title.indexOf(": ");
  const description = localized(event, "description", locale);
  const { details } = event;
  const facts = [
    { icon: CalendarDays, text: `${longDay(event.startsAt, locale)} · ${timeRange(event, locale)}` },
    { icon: MapPin, text: `${localized(event, "location", locale)} · ${t.brand.library}` },
    ...(details.audience ? [{ icon: Users, text: pick(details.audience, locale) }] : []),
  ];

  return (
    <>
      <section className="flex flex-wrap">
        <div className="relative min-h-70 flex-[1_1_560px] overflow-hidden bg-[#4A3020] sm:min-h-115">
          <Image src={event.imageUrl ?? "/images/event-detail.jpg"} alt={p.imageAlt} fill priority sizes="(max-width: 1000px) 100vw, 50vw" className="animate-zoom object-cover" />
        </div>
        <div className="flex flex-[1_1_440px] flex-col justify-center gap-4.5 bg-plum-700 px-5 py-10 text-cream sm:px-[clamp(24px,5.5vw,80px)] sm:py-[clamp(40px,5vw,72px)]">
          <nav aria-label={p.breadcrumb} className="flex gap-2.5 text-[13px] text-[#D8C2CF]">
            <Link href={`/${locale}/events`} className="text-[#D8C2CF] no-underline hover:text-cream">
              {t.events.title}
            </Link>
            <span aria-hidden>/</span>
            <span aria-current="page">{t.events.kinds[event.kind]}</span>
          </nav>
          <h1 className="m-0 font-serif text-[44px] leading-[1.02] font-normal sm:text-[clamp(44px,4.4vw,64px)]">
            {split > 0 ? (
              <>
                {title.slice(0, split + 1)}
                <br />
                <span className="[hyphens:auto]">{title.slice(split + 2)}</span>
              </>
            ) : (
              title
            )}
          </h1>
          <div className="mt-1.5 flex flex-col gap-2.5">
            {facts.map(({ icon: Icon, text }) => (
              <span key={text} className="flex items-center gap-3 text-base">
                <Icon aria-hidden size={18} strokeWidth={1.5} className="flex-none" />
                {text}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="container-page flex flex-wrap items-start gap-x-18 gap-y-14 pt-14 pb-24 sm:pt-18 sm:pb-26">
        <article className="flex min-w-0 flex-[999_1_560px] flex-col gap-12">
          {description && (
            <section className="flex flex-col gap-4">
              <h2 className="m-0 font-serif text-[32px] font-normal sm:text-4xl">{event.kind === "BOOK_CLUB" ? p.about : p.aboutDay}</h2>
              {description.split(/\n+/).map((para, i) => (
                <p key={i} className="m-0 max-w-160 text-lg leading-[1.7] font-light">
                  {para}
                </p>
              ))}
            </section>
          )}

          {details.programme && details.programme.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="m-0 mb-3 font-serif text-[32px] font-normal sm:text-4xl">{p.programme}</h2>
              <ol className="m-0 list-none border-t border-line p-0">
                {details.programme.map((item) => (
                  <li key={item.time} className="grid grid-cols-[72px_minmax(0,1fr)] gap-6 border-b border-line py-4.5 sm:grid-cols-[96px_minmax(0,1fr)]">
                    <span className="font-serif text-2xl">{item.time}</span>
                    <span className="flex flex-col gap-1">
                      <span className="text-base font-medium">{pick(item.title, locale)}</span>
                      {item.note && <span className="text-sm text-ink-muted">{pick(item.note, locale)}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <ExtraCards event={event} t={t} locale={locale} />
        </article>

        <aside aria-label={p.rsvpCard} className="w-full flex-[1_1_340px] border border-line bg-paper-3 shadow-pop md:max-w-100">
          <Suspense fallback={<div className="h-80" />}>
            <Rsvp event={event} t={t} locale={locale} />
          </Suspense>
        </aside>
      </div>
    </>
  );
}

function ExtraCards({ event, t, locale }: { event: EventDetailDto; t: Dictionary; locale: Locale }) {
  const p = t.eventPage;
  const { book, details } = event;
  if (!book && !details.host && !details.directions) return null;
  const card = "flex flex-col gap-2 border border-line bg-paper-3 p-6";
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
      {book && (
        <section className="flex gap-4.5 border border-line bg-paper-3 p-6">
          <Link href={`/${locale}/books/${book.slug}`} className="flex-none">
            <BookCover book={book} sizes="64px" className="w-16" />
          </Link>
          <div className="flex flex-col gap-1.5">
            <span className="eyebrow text-[10px] text-ink-muted">{p.bringBook}</span>
            <span lang={book.language} className="font-serif text-[22px] leading-[1.1]">
              {book.title}
            </span>
            {book.availability.available === 0 && book.availability.nextDueAt ? (
              <span className="text-[13px] text-loan">{format(p.allOut, { date: formatShortDate(book.availability.nextDueAt, locale) })}</span>
            ) : null}
            <Link href={`/${locale}/books/${book.slug}`} className="eyebrow mt-1 text-[10px] text-ink no-underline hover:text-plum-500">
              {book.availability.available === 0 ? p.joinBookWaitlist : p.seeBook}
            </Link>
          </div>
        </section>
      )}
      {details.host && (
        <section className={card}>
          <span className="eyebrow text-[10px] text-ink-muted">{p.hostedBy}</span>
          <span className="font-serif text-[22px] leading-[1.15]">{pick(details.host.name, locale)}</span>
          {details.host.note && <span className="text-sm text-ink-muted">{pick(details.host.note, locale)}</span>}
        </section>
      )}
      {details.directions && (
        <section className={card}>
          <span className="eyebrow text-[10px] text-ink-muted">{p.gettingThere}</span>
          <span className="text-[15px] leading-[1.55]">{pick(details.directions, locale)}</span>
        </section>
      )}
    </div>
  );
}

/** The member-specific RSVP card; visitors are asked to sign in. */
async function Rsvp({ event, t, locale }: { event: EventDetailDto; t: Dictionary; locale: Locale }) {
  const p = t.eventPage;
  const when = `${formatDay(event.startsAt, locale)} · ${formatTime(event.startsAt, locale)}`;
  const ended = new Date(event.endsAt ?? event.startsAt).getTime() < (await requestTime());

  if (ended || !event.rsvpRequired) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <span className="eyebrow text-[10px] text-ink-muted">{when}</span>
        <span className="font-serif text-[34px] leading-[1.05]">{ended ? p.over : p.noRsvpTitle}</span>
        <span className="text-[15px] leading-normal text-ink-muted">{ended ? p.overText : p.noRsvpText}</span>
        {ended && (
          <Link href={`/${locale}/events`} className="eyebrow inline-flex h-12 items-center justify-center border border-ink text-[11px] text-ink no-underline hover:bg-ink hover:text-paper">
            {p.allEvents}
          </Link>
        )}
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const [profile, rsvp] = data?.claims
    ? await Promise.all([
        api<ProfileDto>("/me", { auth: true }).catch(() => null),
        api<MyRsvpDto>(`/events/${encodeURIComponent(event.slug)}/rsvp`, { auth: true }).catch(() => null),
      ])
    : [null, null];
  const end = event.endsAt ?? new Date(new Date(event.startsAt).getTime() + 2 * 3_600_000).toISOString();

  return (
    <RsvpCard
      slug={event.slug}
      locale={locale}
      when={when}
      capacity={event.capacity}
      going={event.registered}
      waiting={event.waitlisted}
      memberName={profile?.fullName ?? null}
      initial={rsvp}
      calendar={{ title: localized(event, "title", locale), start: event.startsAt, end, location: localized(event, "location", locale) }}
      t={p}
    />
  );
}

/** The time of this request; waits for the request first so prerendering never reads the clock. */
async function requestTime() {
  await connection();
  return Date.now();
}
