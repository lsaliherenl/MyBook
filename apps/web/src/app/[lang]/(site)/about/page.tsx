import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowRight,
  Barcode,
  BookOpen,
  Bookmark,
  Coffee,
  Cpu,
  FlaskConical,
  Inbox,
  Lamp,
  Landmark,
  Palette,
  Scroll,
  Users,
  Feather,
  Atom,
  Check,
  Minus,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { format, getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getFacets, getRules } from "@/lib/catalog";
import { formatMoney, formatNumber } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.nav.about, description: t.about.intro2 };
}

/** Hover icons for each floor, top floor first. */
const FLOOR_ICONS: LucideIcon[][] = [
  [BookOpen, Feather, Bookmark],
  [Landmark, Scroll, Palette],
  [Lamp, Coffee, Users],
  [Atom, Cpu, FlaskConical],
  [Barcode, Inbox, Bookmark],
];

export default async function AboutPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const [rules, facets] = await Promise.all([getRules(), getFacets({})]);
  const a = t.about;
  const r = a.rules;
  const money = (n: number) => formatMoney(n, locale);

  const stats = [
    { value: formatNumber(facets?.catalogTotal ?? 0, locale), label: a.statBooks },
    { value: "5", label: a.statFloors },
    { value: "420", label: a.statSeats },
    { value: "78", label: a.statHours },
  ];
  const ruleCards = [
    { value: format(r.loanValue, { n: String(rules.loanDays) }), title: r.loanTitle, text: r.loanText },
    { value: format(r.limitValue, { n: String(rules.maxActiveLoans) }), title: r.limitTitle, text: r.limitText },
    { value: format(r.renewValue, { n: String(rules.maxRenewals) }), title: r.renewTitle, text: r.renewText },
    { value: format(r.pickupValue, { n: String(rules.pickupWindowHours) }), title: r.pickupTitle, text: r.pickupText },
    { value: money(rules.finePerDay), title: r.fineTitle, text: format(r.fineText, { limit: money(rules.fineBlockThreshold) }) },
    { value: r.lostValue, title: r.lostTitle, text: r.lostText },
  ];
  const hours = [
    [a.weekdays, "08:00 – 22:00"],
    [a.saturday, "10:00 – 18:00"],
    [a.sunday, a.closed],
    [a.examWeeks, a.untilMidnight],
  ];

  return (
    <>
      <section className="container-page flex flex-col gap-8 pt-14 pb-12 sm:gap-10 sm:pt-20 sm:pb-16">
        <span className="eyebrow text-plum-500">{a.eyebrow}</span>
        <h1 className="m-0 max-w-250 font-serif text-[52px] leading-[.94] font-light sm:text-[clamp(56px,7vw,108px)]">{a.title}</h1>
        <div className="grid max-w-250 grid-cols-1 gap-x-16 gap-y-6 md:grid-cols-2">
          <p className="m-0 text-lg leading-[1.7] font-light">{a.intro1}</p>
          <p className="m-0 text-lg leading-[1.7] font-light">{a.intro2}</p>
        </div>
      </section>

      <div className="relative h-[clamp(320px,38vw,560px)] overflow-hidden">
        <Image src="/images/about-atrium.jpg" alt={a.imageAlt} fill sizes="100vw" className="animate-zoom object-cover object-[center_45%]" />
      </div>

      <section aria-label={a.numbers} className="bg-plum-700 text-cream">
        <div className="container-page grid grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`flex flex-col gap-1.5 border-cream/16 py-8 sm:py-10 ${i % 2 === 0 ? "border-r pr-6" : "pl-6"} lg:px-6 lg:first:pl-0 ${i < 3 ? "lg:border-r" : ""}`}
            >
              <span className="font-serif text-[44px] leading-none font-light sm:text-[56px]">{s.value}</span>
              <span className="eyebrow text-[10px] text-[#D8C2CF]">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="contact" aria-labelledby="h-visit" className="container-page flex scroll-mt-8 flex-wrap gap-x-20 gap-y-14 pt-20 sm:pt-26">
        <div className="flex flex-[1_1_360px] flex-col gap-5.5">
          <span className="eyebrow text-plum-500">{a.visitEyebrow}</span>
          <h2 id="h-visit" className="m-0 font-serif text-[40px] leading-[1.02] font-normal sm:text-[52px]">
            {a.visitTitle}
          </h2>
          <address className="text-[17px] leading-[1.7] not-italic">
            {t.brand.library}
            <br />
            {t.footer.address}
            <br />
            {t.footer.city}
          </address>
          <div className="flex flex-col gap-1.5 text-[15px]">
            <a href={`mailto:${a.email}`} className="text-ink no-underline hover:text-plum-500">
              {a.email}
            </a>
            <a href={`tel:${a.phone.replaceAll(" ", "")}`} className="text-ink no-underline hover:text-plum-500">
              {a.phone}
            </a>
          </div>
          <a
            href="https://www.google.com/maps/search/?api=1&query=university+central+library"
            target="_blank"
            rel="noopener"
            className="eyebrow group inline-flex h-12.5 items-center gap-3 self-start border border-ink px-5.5 text-[11px] text-ink no-underline hover:bg-ink hover:text-paper"
          >
            {a.directions}
            <ArrowRight aria-hidden size={16} strokeWidth={1.5} className="transition-transform group-hover:translate-x-1" />
          </a>
        </div>
        <div className="flex flex-[1_1_420px] flex-col gap-4.5">
          <h3 className="m-0 font-serif text-[26px] font-medium">{a.hours}</h3>
          <dl className="m-0 border-t border-line text-base">
            {hours.map(([label, value]) => (
              <div key={label} className={`flex justify-between border-b border-line py-3.5 ${value === a.closed ? "text-ink-muted" : ""}`}>
                <dt>{label}</dt>
                <dd className="m-0 tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="m-0 text-sm text-ink-muted">{a.hoursNote}</p>
        </div>
      </section>

      <section aria-labelledby="h-floors" className="container-page pt-20 sm:pt-26">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-3.5">
            <span className="eyebrow text-plum-500">{a.floorsEyebrow}</span>
            <h2 id="h-floors" className="m-0 font-serif text-[40px] leading-[1.02] font-normal sm:text-[52px]">
              {a.floorsTitle}
            </h2>
          </div>
          <span className="text-sm text-ink-muted">{a.floorsNote}</span>
        </div>
        <ol className="m-0 list-none border-t border-ink p-0">
          {a.floors.map(([floor, name, text], i) => (
            <li
              key={floor}
              className="group grid grid-cols-[56px_minmax(0,1fr)] items-baseline gap-x-8 gap-y-1.5 border-b border-line py-6 transition-[background-color] duration-350 hover:bg-linear-to-r hover:from-loan-bg/55 hover:to-transparent md:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)]"
            >
              <span className="row-span-2 font-serif text-[44px] leading-none md:row-span-1">{floor}</span>
              <span className="flex items-center font-serif text-[26px]">
                {name}
                <span className="hover-icons ml-4 inline-flex gap-2.5 text-plum-500">
                  {FLOOR_ICONS[i].map((Icon, j) => (
                    <Icon key={j} aria-hidden size={22} strokeWidth={1.5} />
                  ))}
                </span>
              </span>
              <span className="text-[15px] text-ink-muted">{text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section id="rules" aria-labelledby="h-rules" className="container-page scroll-mt-8 pt-20 sm:pt-26">
        <div className="mb-8 flex flex-col gap-3.5">
          <span className="eyebrow text-plum-500">{a.rulesEyebrow}</span>
          <h2 id="h-rules" className="m-0 font-serif text-[40px] leading-[1.02] font-normal sm:text-[52px]">
            {a.rulesTitle}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {ruleCards.map((card) => {
            const [num, ...unit] = card.value.split(" ");
            const hasUnit = unit.length > 0 && /^\d/.test(num);
            return (
              <div key={card.title} className="flex flex-col gap-2 bg-paper-3 p-7">
                <span className="font-serif text-[52px] leading-none font-light">
                  {hasUnit ? num : card.value}
                  {hasUnit && <span className="text-2xl"> {unit.join(" ")}</span>}
                </span>
                <span className="text-base font-medium">{card.title}</span>
                <span className="text-sm leading-normal text-ink-muted">{card.text}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="container-page flex flex-wrap gap-x-20 gap-y-14 pt-20 pb-24 sm:pt-26 sm:pb-28">
        <div id="accessibility" aria-labelledby="h-access" className="flex flex-[1_1_340px] scroll-mt-8 flex-col gap-4.5">
          <span className="eyebrow text-plum-500">{a.accessEyebrow}</span>
          <h2 id="h-access" className="m-0 font-serif text-[36px] leading-[1.05] font-normal sm:text-[40px]">
            {a.accessTitle}
          </h2>
          <ul className="m-0 flex list-none flex-col gap-3.5 p-0 text-[15px] leading-normal">
            {a.access.map((item) => (
              <li key={item} className="flex gap-3.5">
                <Check aria-hidden size={20} strokeWidth={1.5} className="flex-none text-plum-500" />
                {item}
              </li>
            ))}
          </ul>
          <div id="privacy" className="mt-6 flex scroll-mt-8 flex-col gap-3 border-t border-line pt-6">
            <h3 className="m-0 font-serif text-2xl font-medium">{a.privacyTitle}</h3>
            <p className="m-0 text-sm leading-relaxed text-ink-muted">{a.privacyText}</p>
          </div>
        </div>
        <div aria-labelledby="h-faq" className="flex flex-[1.4_1_460px] flex-col gap-4.5">
          <span className="eyebrow text-plum-500">{a.faqEyebrow}</span>
          <h2 id="h-faq" className="m-0 font-serif text-[36px] leading-[1.05] font-normal sm:text-[40px]">
            {a.faqTitle}
          </h2>
          <div className="border-t border-ink">
            {a.faq.map(([q, answer], i) => (
              <details key={q} open={i === 0} className="group border-b border-line">
                <summary className="flex cursor-pointer items-center justify-between gap-4 py-5 font-serif text-[21px] sm:text-[23px]">
                  {q}
                  <Plus aria-hidden size={18} strokeWidth={1.5} className="flex-none group-open:hidden" />
                  <Minus aria-hidden size={18} strokeWidth={1.5} className="hidden flex-none group-open:block" />
                </summary>
                <p className="m-0 mb-5 max-w-155 text-[15px] leading-[1.65] text-ink-muted">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
