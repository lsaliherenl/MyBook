"use client";

import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { toggle } from "@/lib/catalog-params";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { useCatalogNav } from "./catalog-nav";

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

interface Labels {
  toggle: string;
  filters: string;
  category: string;
  showAll: string;
  showLess: string;
  language: string;
  availability: string;
  availableNow: string;
  availabilityHint: string;
  year: string;
  yearFrom: string;
  yearTo: string;
  applyYears: string;
  author: string;
  findAuthor: string;
}

const VISIBLE_CATEGORIES = 5;

/** Left column of the catalog; on phones it folds into a "Categories & filters" panel. */
export function CatalogFilters({
  categories,
  languages,
  authors,
  labels,
}: {
  categories: FilterOption[];
  languages: FilterOption[];
  authors: FilterOption[];
  labels: Labels;
}) {
  const { params, update } = useCatalogNav();
  const [open, setOpen] = useState(false);
  const [allCategories, setAllCategories] = useState(false);
  const [authorQuery, setAuthorQuery] = useState("");

  // Selected categories stay visible even when the list is folded.
  const shownCategories = allCategories
    ? categories
    : categories.filter((c, i) => i < VISIBLE_CATEGORIES || params.category.includes(c.value));
  const fold = (s: string) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/\p{M}/gu, "");
  const shownAuthors = authorQuery ? authors.filter((a) => fold(a.label).includes(fold(authorQuery))) : authors;

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="catalog-filters"
        onClick={() => setOpen(!open)}
        className="flex h-13 w-full items-center justify-between gap-3 border border-line bg-paper-3 px-4 text-[15px] md:hidden"
      >
        <span className="inline-flex items-center gap-2.5">
          <SlidersHorizontal aria-hidden size={18} strokeWidth={1.5} />
          {labels.toggle}
        </span>
        <ChevronDown aria-hidden size={18} strokeWidth={1.5} className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>

      <aside
        id="catalog-filters"
        aria-label={labels.filters}
        className={`w-full flex-col gap-9 px-0.5 pt-1 pb-2 md:flex md:max-w-65 md:flex-[1_1_240px] md:p-0 ${open ? "flex animate-swap" : "hidden"}`}
      >
        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="eyebrow mb-4 text-ink-muted">{labels.category}</legend>
          {shownCategories.map((c) => (
            <CheckRow
              key={c.value}
              option={c}
              icon={CATEGORY_ICONS[c.value]?.[0]}
              checked={params.category.includes(c.value)}
              onChange={() => update({ category: toggle(params.category, c.value) })}
            />
          ))}
          {categories.length > VISIBLE_CATEGORIES && (
            <button type="button" onClick={() => setAllCategories(!allCategories)} className="eyebrow mt-1 self-start text-[10.5px] text-plum-500 underline underline-offset-4">
              {allCategories ? labels.showLess : labels.showAll.replace("{count}", String(categories.length))}
            </button>
          )}
        </fieldset>

        {languages.length > 0 && (
          <fieldset className="m-0 flex flex-col gap-3 border-0 border-t border-line p-0 pt-6">
            <legend className="eyebrow float-left mb-4 w-full text-ink-muted">{labels.language}</legend>
            {languages.map((l) => (
              <CheckRow key={l.value} option={l} checked={params.language.includes(l.value)} onChange={() => update({ language: toggle(params.language, l.value) })} />
            ))}
          </fieldset>
        )}

        <fieldset className="m-0 flex flex-col gap-3.5 border-0 border-t border-line p-0 pt-6">
          <legend className="eyebrow float-left mb-4 w-full text-ink-muted">{labels.availability}</legend>
          <label className="flex cursor-pointer items-center justify-between gap-3 text-[15px]">
            {labels.availableNow}
            <input
              type="checkbox"
              role="switch"
              checked={params.available}
              onChange={(e) => update({ available: e.target.checked })}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className="relative h-5.5 w-10 flex-none rounded-full bg-line transition-colors peer-checked:bg-plum-700 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-plum-500 after:absolute after:top-0.75 after:left-0.75 after:size-4 after:rounded-full after:bg-paper-3 after:transition-transform after:duration-300 peer-checked:after:translate-x-4.5"
            />
          </label>
          <span className="text-[13px] leading-normal text-ink-muted">{labels.availabilityHint}</span>
        </fieldset>

        <YearRange labels={labels} />

        {authors.length > 0 && (
          <fieldset className="m-0 flex flex-col gap-3 border-0 border-t border-line p-0 pt-6">
            <legend className="eyebrow float-left mb-4 w-full text-ink-muted">{labels.author}</legend>
            <label htmlFor="filter-author" className="sr-only">
              {labels.findAuthor}
            </label>
            <input
              id="filter-author"
              type="text"
              value={authorQuery}
              onChange={(e) => setAuthorQuery(e.target.value)}
              placeholder={labels.findAuthor}
              className="h-10 rounded-xs border border-line bg-paper-3 px-3 text-[15px] text-ink"
            />
            {shownAuthors.map((a) => (
              <CheckRow key={a.value} option={a} checked={params.author.includes(a.value)} onChange={() => update({ author: toggle(params.author, a.value) })} />
            ))}
          </fieldset>
        )}
      </aside>
    </>
  );
}

function CheckRow({
  option,
  checked,
  onChange,
  icon: Icon,
}: {
  option: FilterOption;
  checked: boolean;
  onChange: () => void;
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>;
}) {
  return (
    <label className="group flex cursor-pointer items-center gap-3 text-[15px] hover:text-plum-700">
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        aria-hidden
        className={`inline-flex size-4.5 flex-none items-center justify-center rounded-xs peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-plum-500 ${
          checked ? "bg-plum-700 text-paper" : "border border-ink-muted group-hover:border-plum-500"
        }`}
      >
        {checked && <Check size={12} strokeWidth={2} />}
      </span>
      <span className="inline-flex flex-1 items-center gap-2.5">
        {option.label}
        {Icon && (
          <span className="hover-icons inline-flex text-plum-500">
            <Icon aria-hidden size={16} strokeWidth={1.5} />
          </span>
        )}
      </span>
      <span className="text-[13px] text-ink-muted">{option.count}</span>
    </label>
  );
}

function YearRange({ labels }: { labels: Labels }) {
  const { params, update } = useCatalogNav();
  const [from, setFrom] = useState(params.yearFrom ? String(params.yearFrom) : "");
  const [to, setTo] = useState(params.yearTo ? String(params.yearTo) : "");
  const key = `${params.yearFrom}-${params.yearTo}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setFrom(params.yearFrom ? String(params.yearFrom) : "");
    setTo(params.yearTo ? String(params.yearTo) : "");
  }
  const parse = (v: string) => (/^\d{1,4}$/.test(v) ? Number(v) : null);
  const changed = parse(from) !== params.yearFrom || parse(to) !== params.yearTo;

  return (
    <fieldset className="m-0 flex flex-col gap-3.5 border-0 border-t border-line p-0 pt-6">
      <legend className="eyebrow float-left mb-4 w-full text-ink-muted">{labels.year}</legend>
      <form
        className="flex items-end gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          update({ yearFrom: parse(from), yearTo: parse(to) });
        }}
      >
        <label className="flex flex-1 flex-col gap-1 text-xs text-ink-muted">
          {labels.yearFrom}
          <input value={from} onChange={(e) => setFrom(e.target.value)} inputMode="numeric" maxLength={4} className="h-10 w-full rounded-xs border border-line bg-paper-3 px-3 text-[15px] text-ink" />
        </label>
        <span aria-hidden className="pb-2.5 text-ink-muted">
          –
        </span>
        <label className="flex flex-1 flex-col gap-1 text-xs text-ink-muted">
          {labels.yearTo}
          <input value={to} onChange={(e) => setTo(e.target.value)} inputMode="numeric" maxLength={4} className="h-10 w-full rounded-xs border border-line bg-paper-3 px-3 text-[15px] text-ink" />
        </label>
        {changed && (
          <button type="submit" className="eyebrow h-10 animate-swap border border-ink px-3 text-[10px] hover:bg-ink hover:text-paper">
            {labels.applyYears}
          </button>
        )}
      </form>
    </fieldset>
  );
}
