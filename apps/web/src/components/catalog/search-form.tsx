"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { useCatalogNav } from "./catalog-nav";

export function CatalogSearchForm({ label, placeholder, button }: { label: string; placeholder: string; button: string }) {
  const { params, update } = useCatalogNav();
  const [q, setQ] = useState(params.q);
  // Follow the URL when it changes elsewhere (chips, "Clear all", back button).
  const [lastQ, setLastQ] = useState(params.q);
  if (params.q !== lastQ) {
    setLastQ(params.q);
    setQ(params.q);
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        update({ q: q.trim() });
      }}
      className="flex h-16 items-center gap-3 border border-line bg-paper-3 pr-2 pl-4 sm:h-20 sm:gap-4 sm:pr-3 sm:pl-6"
    >
      <Search aria-hidden size={24} strokeWidth={1.5} className="flex-none" />
      <label htmlFor="catalog-q" className="sr-only">
        {label}
      </label>
      <input
        id="catalog-q"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="min-w-0 flex-1 border-0 bg-transparent font-serif text-[22px] text-ink outline-none placeholder:text-ink-muted/70 sm:text-[30px]"
      />
      <button type="submit" className="eyebrow h-12 flex-none bg-plum-700 px-5 text-xs text-paper hover:bg-plum-900 sm:h-14 sm:px-7">
        {button}
      </button>
    </form>
  );
}
