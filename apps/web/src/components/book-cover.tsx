import Image from "next/image";
import type { BookSummaryDto } from "@mybook/shared";

type CoverBook = Pick<BookSummaryDto, "slug" | "title" | "authors" | "coverUrl" | "language">;

/*
 * Typographic covers for books without a scanned cover, taken from the design's demo covers.
 * Every size is in container-query units, so one cover works from a 56px bag thumbnail to the 360px detail hero.
 */
type Layout = "centered" | "framed" | "top-author" | "bottom" | "diamond" | "band" | "middle";

interface Style {
  bg: string;
  fg: string;
  accent: string;
  layout: Layout;
  italic?: boolean;
  light?: boolean;
}

const STYLES: Style[] = [
  { bg: "#4A2238", fg: "#EFE2CC", accent: "#DCC6A6", layout: "centered" },
  { bg: "#E9DFCC", fg: "#231A1F", accent: "#231A1F", layout: "framed", italic: true },
  { bg: "#241B21", fg: "#D9B783", accent: "#B88A4A", layout: "centered", light: true },
  { bg: "#55684F", fg: "#F1EAE0", accent: "#DCE3D2", layout: "bottom" },
  { bg: "#8E4A36", fg: "#F6EADF", accent: "#F0D6C6", layout: "top-author" },
  { bg: "#DCCFBD", fg: "#4A2238", accent: "#6E3B57", layout: "diamond" },
  { bg: "#6E3B57", fg: "#F3E6EC", accent: "#E4CCD8", layout: "top-author" },
  { bg: "#2E1424", fg: "#EADCC8", accent: "#CDB28C", layout: "middle" },
  { bg: "#E2D5BE", fg: "#4A2238", accent: "#4A2238", layout: "framed" },
  { bg: "#F1EAE0", fg: "#231A1F", accent: "#6E3B57", layout: "band" },
];

function styleFor(slug: string): Style {
  let hash = 0;
  for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return STYLES[hash % STYLES.length];
}

/** "Yuval Noah Harari" → "Y. N. Harari" once the name gets long; covers have little room. */
function shortAuthor(name: string): string {
  if (name.length <= 16) return name;
  const parts = name.split(" ");
  return [...parts.slice(0, -1).map((p) => `${p[0]}.`), parts.at(-1)].join(" ");
}

export function BookCover({
  book,
  sizes,
  className = "",
  priority = false,
}: {
  book: CoverBook;
  /** next/image sizes hint, e.g. "(max-width: 760px) 156px, 220px". */
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  const frame = `relative aspect-[2/3] shrink-0 overflow-hidden shadow-cover ${className}`;

  if (book.coverUrl) {
    return (
      <div className={`${frame} bg-paper-2`}>
        <Image src={book.coverUrl} alt="" fill sizes={sizes} priority={priority} className="object-cover" />
        {/* A soft spine shadow so flat scans read as books. */}
        <span aria-hidden className="absolute inset-y-0 left-0 w-[6%] bg-linear-to-r from-black/25 to-transparent" />
      </div>
    );
  }

  const s = styleFor(book.slug);
  const author = book.authors[0] ? shortAuthor(book.authors[0].name) : "";
  const title = (
    <span
      lang={book.language}
      className="font-serif leading-[1.02] [hyphens:auto] [overflow-wrap:anywhere]"
      style={{
        fontSize: book.title.length > 28 ? "9.5cqw" : book.title.length > 16 ? "12cqw" : "14.5cqw",
        fontStyle: s.italic ? "italic" : undefined,
        fontWeight: s.light ? 300 : s.layout === "diamond" ? 500 : 400,
      }}
    >
      {book.title}
    </span>
  );
  const byline = (
    <span className="font-sans font-medium uppercase" style={{ fontSize: "max(6px, 4cqw)", letterSpacing: ".24em", color: s.accent }}>
      {author}
    </span>
  );

  const layouts: Record<Layout, React.ReactNode> = {
    centered: (
      <div className="flex h-full flex-col items-center justify-between text-center" style={{ padding: "13cqw 8cqw 10cqw" }}>
        {byline}
        {title}
        <span className="h-px w-[13cqw]" style={{ background: "#B88A4A" }} />
      </div>
    ),
    framed: (
      <div className="flex h-full flex-col justify-between" style={{ padding: "12cqw 9cqw", outline: `1px solid ${s.fg}38`, outlineOffset: "-4.5cqw" }}>
        {title}
        {byline}
      </div>
    ),
    "top-author": (
      <div className="flex h-full flex-col justify-between" style={{ padding: "11cqw 8cqw" }}>
        {byline}
        {title}
      </div>
    ),
    bottom: (
      <div className="flex h-full flex-col justify-end gap-[5cqw]" style={{ padding: "11cqw 9cqw" }}>
        <span className="aspect-square w-[17cqw] rounded-full border" style={{ borderColor: `${s.fg}99` }} />
        {title}
        {byline}
      </div>
    ),
    diamond: (
      <div className="flex h-full flex-col items-center justify-between text-center" style={{ padding: "12cqw 8cqw" }}>
        <span className="aspect-square w-[12cqw] rotate-45 border" style={{ borderColor: s.accent }} />
        {title}
        {byline}
      </div>
    ),
    band: (
      <div className="flex h-full flex-col justify-between" style={{ padding: "11cqw 8.5cqw", outline: "1px solid var(--color-line)", outlineOffset: "-1px" }}>
        <span className="h-[4cqw] w-full" style={{ background: s.accent }} />
        {title}
        {byline}
      </div>
    ),
    middle: (
      <div className="flex h-full flex-col justify-center gap-[7cqw]" style={{ padding: "11cqw 8.5cqw" }}>
        {title}
        {byline}
      </div>
    ),
  };

  return (
    <div
      role="img"
      aria-label={book.title}
      className={`${frame} @container`}
      style={{ background: s.bg, color: s.fg, boxShadow: "var(--shadow-cover), inset 8px 0 12px -8px rgba(0,0,0,.35)" }}
    >
      {layouts[s.layout]}
    </div>
  );
}
