import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { SYSTEM_TEXT } from "@/i18n/system";

export type SystemKind = "notFound" | "serverError" | "offline";

interface Spine {
  w: number;
  h: number;
  bg: string;
  tilt?: number;
  origin?: "left" | "right";
}

const ROW: Spine[] = [
  { w: 30, h: 186, bg: "#4A2238" },
  { w: 24, h: 210, bg: "#E9DFCC" },
  { w: 36, h: 170, bg: "#241B21" },
  { w: 28, h: 196, bg: "#8E4A36" },
  { w: 22, h: 220, bg: "#DCCFBD" },
];
const TAIL: Spine[] = [
  { w: 34, h: 200, bg: "#55684F" },
  { w: 26, h: 178, bg: "#6E3B57" },
  { w: 30, h: 214, bg: "#E2D5BE" },
  { w: 38, h: 190, bg: "#2E1424" },
  { w: 24, h: 168, bg: "#C9A46C" },
];
/** 500: books leaning over as if the shelf was bumped. */
const TOPPLED: Spine[] = [
  ROW[0],
  { ...ROW[1], tilt: -8 },
  { ...ROW[2], tilt: -14 },
  { ...ROW[3], tilt: -20 },
  { ...ROW[4], tilt: 6, origin: "right" },
  TAIL[0],
  { ...TAIL[1], tilt: 12, origin: "right" },
  { ...TAIL[2], tilt: 16, origin: "right" },
  TAIL[3],
];

function Book({ s }: { s: Spine }) {
  return (
    <span
      className="block"
      style={{
        width: s.w,
        height: s.h,
        background: s.bg,
        transform: s.tilt ? `rotate(${s.tilt}deg)` : undefined,
        transformOrigin: `bottom ${s.origin ?? "left"}`,
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,.06), inset -6px 0 8px -6px rgba(0,0,0,.35)",
      }}
    />
  );
}

/** A shelf of book spines: a gap marked 404, toppled books for 500, faded spines when offline. */
export function Shelf({ kind }: { kind: SystemKind }) {
  const books =
    kind === "serverError" ? TOPPLED : kind === "offline" ? [...ROW, ...TAIL].map((s, i) => ({ ...s, bg: i % 3 === 0 ? s.bg : "#D6CABB" })) : null;
  return (
    <div aria-hidden className="flex flex-[1_1_460px] flex-col items-center">
      <div className="flex h-60 origin-bottom scale-75 items-end gap-1 px-3 sm:scale-100">
        {books
          ? books.map((s, i) => <Book key={i} s={s} />)
          : [
              ...ROW.map((s, i) => <Book key={`r${i}`} s={s} />),
              <span
                key="gap"
                className="flex h-50 w-23 items-center justify-center border border-dashed border-plum-500 bg-[repeating-linear-gradient(135deg,rgba(110,59,87,.06)_0_8px,transparent_8px_16px)]"
              >
                <span className="-rotate-90 font-serif text-[40px] tracking-[.1em] text-plum-500">404</span>
              </span>,
              ...TAIL.map((s, i) => <Book key={`t${i}`} s={s} />),
            ]}
      </div>
      <div className="h-3 w-full max-w-140 bg-ink" />
      <div className="h-4.5 w-full max-w-140 bg-linear-to-b from-ink/18 to-transparent" />
    </div>
  );
}

/** Full-height page with a slim header and footer, used by 404, 500, offline and status. */
export function SystemShell({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const s = SYSTEM_TEXT[locale];
  const links = [
    ["catalog", s.nav.catalog],
    ["collections", s.nav.collections],
    ["events", s.nav.events],
    ["about", s.nav.about],
  ] as const;
  return (
    <div className="flex min-h-[max(900px,100vh)] flex-col bg-paper text-ink max-sm:min-h-screen">
      <header className="border-b border-line">
        <div className="container-page flex flex-wrap items-center justify-between gap-x-10 gap-y-5 py-5.5">
          <Link href={`/${locale}`} className="flex flex-col gap-1.75 text-ink no-underline">
            <span className="font-serif text-[22px] leading-none tracking-[.26em] sm:text-[28px] sm:tracking-[.3em]">{s.brand}</span>
            <span className="eyebrow text-[8px] tracking-[.36em] text-ink-muted sm:text-[9px]">{s.tagline}</span>
          </Link>
          <nav aria-label={s.nav.main} className="hidden flex-wrap gap-x-11 text-[15px] lg:flex">
            {links.map(([href, label]) => (
              <Link key={href} href={`/${locale}/${href}`} className="text-ink no-underline hover:text-plum-500">
                {label}
              </Link>
            ))}
          </nav>
          <span role="group" aria-label={s.nav.language} className="eyebrow inline-flex items-center gap-0.5 text-xs">
            {(["tr", "en"] as const).map((l, i) => (
              <span key={l} className="contents">
                {i > 0 && <span className="text-ink-muted">·</span>}
                <Link
                  href={`/${l}`}
                  hrefLang={l}
                  aria-current={l === locale ? "true" : undefined}
                  className={`p-1.5 no-underline ${l === locale ? "text-ink underline decoration-plum-500 underline-offset-6" : "text-ink-muted hover:text-ink"}`}
                >
                  {l.toUpperCase()}
                </Link>
              </span>
            ))}
          </span>
        </div>
      </header>
      <main className="flex flex-1 items-center">
        <div className="container-page flex w-full flex-wrap items-center gap-x-24 gap-y-14 py-16">{children}</div>
      </main>
      <footer className="border-t border-line">
        <div className="container-page flex flex-wrap justify-between gap-3 py-6 text-[13px] text-ink-muted">
          <span>{s.copyright}</span>
          <span>{s.deskHours}</span>
        </div>
      </footer>
    </div>
  );
}

export function SystemCopy({ kind, locale, children }: { kind: SystemKind; locale: Locale; children: React.ReactNode }) {
  const [eyebrow, title, body] = SYSTEM_TEXT[locale][kind];
  return (
    <div className="flex max-w-140 flex-[1_1_440px] flex-col gap-5.5">
      <span className="eyebrow text-plum-500">{eyebrow}</span>
      <h1 className="m-0 font-serif text-[48px] leading-[.98] font-light sm:text-[clamp(48px,5vw,76px)]">{title}</h1>
      <p className="m-0 text-lg leading-[1.65] font-light text-ink-muted">{body}</p>
      {children}
    </div>
  );
}
