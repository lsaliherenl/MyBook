import {
  Archive,
  Atom,
  BookOpen,
  Dna,
  Feather,
  FlaskConical,
  GraduationCap,
  Landmark,
  NotebookPen,
  Package,
  Quote,
  ScrollText,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";
import type { BookSummaryDto, CollectionKind } from "@mybook/shared";
import { BookCover } from "../book-cover";

/** Background tint of a collection card, one per kind (design: status colours at rest). */
export const KIND_TINT: Record<CollectionKind, string> = {
  COURSE: "bg-paper-2",
  LITERATURE: "bg-loan-bg",
  SCIENCE: "bg-available-bg",
  NEW: "bg-ready-bg",
  SPECIAL: "bg-stone-bg",
};

/** The three icons that pop in when a card is hovered. */
export const KIND_ICONS: Record<CollectionKind, LucideIcon[]> = {
  COURSE: [GraduationCap, NotebookPen, BookOpen],
  LITERATURE: [Feather, Quote, BookOpen],
  SCIENCE: [FlaskConical, Atom, Dna],
  NEW: [Sparkles, Package, Star],
  SPECIAL: [Archive, ScrollText, Landmark],
};

const STACK = [
  { place: "left-[22%] top-7.5 w-24 -rotate-7", hover: "group-hover:-translate-x-2 group-hover:-rotate-10" },
  { place: "left-[39%] top-5.5 w-26 z-1", hover: "group-hover:-translate-y-2" },
  { place: "left-[56%] top-8.5 w-24 rotate-7", hover: "group-hover:translate-x-2 group-hover:rotate-10" },
];

/** Three real covers fanned out on a tinted panel; they spread a little on hover. */
export function CoverStack({ books, kind }: { books: BookSummaryDto[]; kind: CollectionKind }) {
  const Icons = KIND_ICONS[kind];
  return (
    <span aria-hidden className={`relative mb-2.5 block h-55 overflow-hidden ${KIND_TINT[kind]}`}>
      {books.slice(0, 3).map((book, i) => (
        <span key={book.id} className={`absolute transition-transform duration-500 ease-out-soft ${STACK[i].place} ${STACK[i].hover}`}>
          <BookCover book={book} sizes="104px" className="w-full" />
        </span>
      ))}
      <span className="hover-icons absolute top-5 right-5 z-2 inline-flex gap-2.5 text-plum-500">
        {Icons.map((Icon, i) => (
          <Icon key={i} size={20} strokeWidth={1.5} />
        ))}
      </span>
    </span>
  );
}
