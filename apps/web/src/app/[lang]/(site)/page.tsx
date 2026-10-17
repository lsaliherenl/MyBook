import type { Metadata } from "next";
import Image, { getImageProps } from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Barcode,
  Bookmark,
  CalendarDays,
  Clock,
  QrCode,
  RotateCw,
  Search,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import type { CategoryDto, EventDto } from "@mybook/shared";
import { BookCard, RankedCard, ShelfCard } from "@/components/book-card";
import { CurrentMonth } from "@/components/current-month";
import { SectionHeading } from "@/components/section-heading";
import type { Locale } from "@/i18n/config";
import { format, getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { getBooks, getCategories, getCollection, getEvents, getPopularBooks, getRules } from "@/lib/catalog";
import { formatDay, formatMoney, formatTime, localized } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: { absolute: `${t.brand.name} — ${t.brand.tagline}` }, description: t.brand.description };
}

/** The six subjects on the home page. */
const SUBJECTS = ["turkish-literature", "science-nature", "computer-science", "history", "philosophy", "art-design"];

const STEP_ICONS: { main: LucideIcon; hover: LucideIcon[] }[] = [
  { main: ShoppingBag, hover: [Search, Bookmark] },
  { main: QrCode, hover: [Barcode] },
  { main: Clock, hover: [CalendarDays, RotateCw] },
];

export default async function HomePage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const [picks, arrivals, categories, popular, events, rules] = await Promise.all([
    getCollection("staff-picks"),
    getBooks({ pageSize: 6 }),
    getCategories(),
    getPopularBooks(30, 5),
    getEvents("upcoming", 6),
    getRules(),
  ]);
  const event = events.find((e) => e.kind !== "NOTICE");
  const h = t.home;

  return (
    <>
      <Hero t={t} locale={locale} />

      {picks && picks.books.length > 0 && (
        <section aria-labelledby="h-curated" className="pt-16 pb-14 sm:pt-26 sm:pb-24">
          <div className="container-page">
            <SectionHeading
              id="h-curated"
              eyebrow={h.picksEyebrow}
              title={h.picksTitle}
              link={{ href: `/${locale}/collections/staff-picks`, label: h.viewAll, short: h.all }}
              className="mb-7 sm:mb-14"
            />
          </div>
          <div className="shelf-scroll flex scroll-px-5 gap-6 overflow-x-auto px-5 pb-6 sm:container-page sm:grid sm:grid-cols-2 sm:gap-x-12 sm:gap-y-14 sm:overflow-visible sm:pb-0 xl:grid-cols-4">
            {picks.books.slice(0, 4).map((book, i) => (
              <BookCard key={book.id} book={book} locale={locale} t={t.book} priority={i < 2} />
            ))}
          </div>
        </section>
      )}

      {arrivals && arrivals.items.length > 0 && (
        <section aria-labelledby="h-new" className="pb-16 sm:pb-28">
          <div className="container-page">
            <SectionHeading
              id="h-new"
              size="md"
              eyebrow={h.newEyebrow}
              title={h.newTitle}
              link={{ href: `/${locale}/catalog?sort=newest`, label: h.newAll, short: h.all }}
              className="mb-6 border-t border-line pt-10 sm:mb-12 sm:pt-14"
            />
          </div>
          <div className="shelf-scroll flex scroll-px-5 gap-4.5 overflow-x-auto px-5 pb-5 sm:container-page sm:grid sm:grid-cols-3 sm:gap-x-8 sm:gap-y-10 sm:overflow-visible sm:pb-0 xl:grid-cols-6">
            {arrivals.items.map((book) => (
              <ShelfCard key={book.id} book={book} locale={locale} />
            ))}
          </div>
        </section>
      )}

      <Subjects t={t} locale={locale} categories={categories} />

      {popular.length > 0 && (
        <section aria-labelledby="h-most" className="py-16 sm:py-28">
          <div className="container-page">
            <SectionHeading
              id="h-most"
              eyebrow={<CurrentMonth locale={locale} />}
              title={h.mostTitle}
              link={{ href: `/${locale}/catalog?sort=popular`, label: h.mostAll, short: h.all }}
              className="mb-7 sm:mb-14"
            />
            <ol className="shelf-scroll -mr-5 flex list-none gap-4 overflow-x-auto p-0 pr-5 pb-3.5 sm:mr-0 sm:grid sm:grid-cols-3 sm:gap-x-8 sm:gap-y-12 sm:overflow-visible sm:pr-0 sm:pb-0 xl:grid-cols-5">
              {popular.map(({ book }, i) => (
                <li key={book.id} className="min-w-0 flex-[0_0_82%] sm:flex-auto">
                  <RankedCard book={book} rank={i + 1} locale={locale} t={t.book} />
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {event && <EventBand event={event} t={t} locale={locale} />}

      <section aria-labelledby="h-how" className="py-16 sm:py-28">
        <div className="container-page">
          <div className="mb-8 flex flex-col gap-2.5 sm:mb-14 sm:gap-3.5">
            <span className="eyebrow text-plum-500">{h.howEyebrow}</span>
            <h2 id="h-how" className="m-0 font-serif text-[34px] leading-[1.05] font-normal sm:text-[clamp(38px,4vw,54px)]">
              {h.howTitle}
            </h2>
          </div>
          <ol className="m-0 grid list-none grid-cols-1 gap-10 p-0 md:grid-cols-3 md:gap-12">
            {h.steps.map((step, i) => {
              const { main: Main, hover } = STEP_ICONS[i];
              const values = {
                max: String(rules.maxActiveLoans),
                hours: String(rules.pickupWindowHours),
                days: String(rules.loanDays),
                fine: formatMoney(rules.finePerDay, locale),
              };
              return (
                <li key={step.title} className="group flex flex-col gap-4 border-t border-ink pt-6 transition-colors duration-350 hover:border-plum-500">
                  <div className="flex items-center justify-between">
                    <span className="eyebrow text-ink-muted">
                      {h.step} {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="inline-flex items-center gap-3.5">
                      <span className="hover-icons inline-flex items-center gap-2.5 text-plum-500">
                        {hover.map((Icon, j) => (
                          <Icon key={j} aria-hidden size={22} strokeWidth={1.5} />
                        ))}
                      </span>
                      <Main aria-hidden size={28} strokeWidth={1.5} />
                    </span>
                  </div>
                  <span className="font-serif text-[30px] leading-[1.1] sm:text-[34px]">{format(step.title, values)}</span>
                  <span className="text-base leading-relaxed text-ink-muted">{format(step.text, values)}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    </>
  );
}

function Hero({ t, locale }: { t: Dictionary; locale: Locale }) {
  const common = { alt: "", sizes: "100vw", priority: true };
  const desktop = getImageProps({ ...common, src: "/images/hero-desktop.jpg", width: 1776, height: 896, quality: 80 }).props;
  const { srcSet: mobileSrcSet, ...mobile } = getImageProps({ ...common, src: "/images/hero-mobile.jpg", width: 1136, height: 1408, quality: 75 }).props;
  const lines = t.home.heroTitle.split("\n");

  return (
    <section aria-label={t.home.heroCta} className="relative h-165 overflow-hidden bg-[#3A1B2E] sm:h-auto">
      <picture>
        <source media="(min-width: 640px)" srcSet={desktop.srcSet} />
        <img
          {...mobile}
          srcSet={mobileSrcSet}
          alt=""
          className="absolute inset-0 size-full animate-zoom object-cover object-[62%_bottom] sm:object-[72%_60%]"
        />
      </picture>
      <div className="relative container-page flex sm:min-h-165 sm:items-center">
        <div className="flex flex-col gap-4.5 pt-11 text-cream sm:max-w-140 sm:gap-7 sm:pt-18 sm:pb-24">
          <h1 className="m-0 font-serif text-[56px] leading-[.94] font-light tracking-[-.01em] sm:text-[clamp(56px,7.4vw,108px)]">
            {lines.map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </h1>
          <p className="m-0 max-w-95 font-serif text-xl leading-[1.35] text-[#EADCCF] sm:text-2xl">{t.home.heroText}</p>
          <Link
            href={`/${locale}/catalog`}
            className="eyebrow group mt-1 inline-flex h-12 items-center gap-3 self-start bg-[#F3ECE2] px-5.5 text-[11px] text-ink no-underline hover:bg-paper-3 sm:mt-2 sm:h-13 sm:gap-3.5 sm:px-6.5 sm:text-xs"
          >
            {t.home.heroCta}
            <ArrowRight aria-hidden size={16} strokeWidth={1.5} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Subjects({ t, locale, categories }: { t: Dictionary; locale: Locale; categories: CategoryDto[] }) {
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const subjects = SUBJECTS.filter((slug) => bySlug.has(slug));
  if (!subjects.length) return null;
  const keywords = t.home.subjects as Record<string, string>;

  return (
    <section aria-labelledby="h-subjects" className="bg-paper-2 px-5 py-14 sm:px-0 sm:py-26">
      <div className="sm:container-page">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6 sm:mb-12">
          <div className="flex flex-col gap-2.5 sm:gap-3.5">
            <span className="eyebrow text-plum-500">{t.home.subjectsEyebrow}</span>
            <h2 id="h-subjects" className="m-0 font-serif text-[34px] leading-[1.05] font-normal sm:text-[clamp(38px,4vw,54px)]">
              {t.home.subjectsTitle}
            </h2>
          </div>
          <p className="m-0 max-w-95 text-base leading-relaxed text-ink-muted">{t.home.subjectsText}</p>
        </div>
        <div className="grid grid-cols-1 gap-x-16 lg:grid-cols-2">
          {subjects.map((slug) => {
            const category = bySlug.get(slug)!;
            const icons = CATEGORY_ICONS[slug] ?? [];
            return (
              <Link
                key={slug}
                href={`/${locale}/catalog?category=${slug}`}
                className="group relative flex items-center justify-between gap-4 border-t border-ink py-5 text-ink no-underline transition-[background-color,padding] duration-350 ease-out-soft hover:bg-linear-to-r hover:from-loan-bg/55 hover:to-transparent hover:pl-3.5 sm:py-6.5"
              >
                <span className="font-serif text-[32px] leading-none whitespace-nowrap group-hover:italic sm:text-[44px]">
                  {localized(category, "name", locale)}
                </span>
                <span className="relative flex items-center gap-3.5 font-serif text-lg text-ink-muted italic">
                  <span className="hidden transition-[opacity,translate] duration-300 group-hover:-translate-y-2 group-hover:opacity-0 md:inline">
                    {keywords[slug]}
                  </span>
                  <span className="hover-icons pointer-events-none absolute top-1/2 right-8 hidden -translate-y-1/2 gap-3 text-plum-500 md:flex">
                    {icons.map((Icon, i) => (
                      <Icon key={i} aria-hidden size={24} strokeWidth={1.5} />
                    ))}
                  </span>
                  <ArrowRight aria-hidden size={18} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function EventBand({ event, t, locale }: { event: EventDto; t: Dictionary; locale: Locale }) {
  const h = t.home;
  const seatsLeft = event.capacity === null ? null : Math.max(0, event.capacity - event.registered);
  const seats = seatsLeft === null ? h.openSeating : seatsLeft === 0 ? h.full : format(h.seatsLeft, { count: String(seatsLeft) });
  const title = localized(event, "title", locale);
  const [prefix, rest] = title.includes(": ") ? [title.slice(0, title.indexOf(": ") + 1), title.slice(title.indexOf(": ") + 2)] : [null, title];

  return (
    <section aria-labelledby="h-event" className="flex flex-wrap">
      <div className="relative min-h-75 flex-[1_1_560px] overflow-hidden bg-[#4A3020] sm:min-h-135">
        <Image
          src={event.imageUrl ?? "/images/library-interior.jpg"}
          alt={h.eventImageAlt}
          fill
          sizes="(max-width: 1000px) 100vw, 50vw"
          className="object-cover object-[center_60%]"
        />
      </div>
      <div className="flex flex-[1_1_440px] flex-col justify-center gap-5.5 bg-plum-700 px-5 py-12 text-cream sm:px-[clamp(24px,5.5vw,80px)] sm:py-[clamp(48px,6vw,88px)]">
        <span className="eyebrow text-[#D8C2CF]">{h.eventEyebrow}</span>
        <h2 id="h-event" className="m-0 font-serif text-[40px] leading-[1.04] font-normal sm:text-[clamp(40px,3.8vw,54px)]">
          {prefix && (
            <>
              {prefix}
              <br />
            </>
          )}
          <span className="[hyphens:auto]">{rest}</span>
        </h2>
        {localized(event, "description", locale) && (
          <p className="m-0 max-w-105 text-[17px] leading-relaxed text-[#E3D3DB]">{localized(event, "description", locale)}</p>
        )}
        <div className="mt-1.5 flex flex-col gap-1.5">
          <span className="eyebrow text-[13px] text-cream">
            {formatDay(event.startsAt, locale)} · {formatTime(event.startsAt, locale)}
          </span>
          <span className="text-[15px] text-[#D8C2CF]">
            {localized(event, "location", locale)} · {seats}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-7">
          <Link
            href={`/${locale}/events/${event.slug}`}
            className="eyebrow group inline-flex h-12.5 items-center gap-3.5 bg-[#F3ECE2] px-6 text-xs text-ink no-underline hover:bg-paper-3"
          >
            {h.rsvp}
            <ArrowRight aria-hidden size={16} strokeWidth={1.5} className="transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href={`/${locale}/events`} className="eyebrow text-cream underline decoration-cream/40 underline-offset-6 hover:decoration-cream">
            {h.allEvents}
          </Link>
        </div>
      </div>
    </section>
  );
}
