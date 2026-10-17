"use client";

import { ChevronDown, LayoutGrid, List, X } from "lucide-react";
import { hasFilters, type CatalogParams } from "@/lib/catalog-params";
import { useCatalogNav } from "./catalog-nav";

interface Labels {
  forQuery: string;
  removeFilter: string;
  clearAll: string;
  sort: string;
  sorts: Record<CatalogParams["sort"], string>;
  view: string;
  gridView: string;
  listView: string;
}

/** Result count, removable filter chips, sort and grid/list toggle. */
export function CatalogToolbar({
  countLabel,
  names,
  labels,
}: {
  countLabel: string;
  /** Display names for category slugs, language codes and author slugs. */
  names: Record<string, string>;
  labels: Labels;
}) {
  const { params, update } = useCatalogNav();
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...params.category.map((v) => ({ key: `c:${v}`, label: names[`category:${v}`] ?? v, remove: () => update({ category: params.category.filter((x) => x !== v) }) })),
    ...params.language.map((v) => ({ key: `l:${v}`, label: names[`language:${v}`] ?? v, remove: () => update({ language: params.language.filter((x) => x !== v) }) })),
    ...params.author.map((v) => ({ key: `a:${v}`, label: names[`author:${v}`] ?? v, remove: () => update({ author: params.author.filter((x) => x !== v) }) })),
  ];
  if (params.available) chips.push({ key: "available", label: names.available, remove: () => update({ available: false }) });
  if (params.yearFrom || params.yearTo) {
    chips.push({ key: "years", label: `${params.yearFrom ?? "…"}–${params.yearTo ?? "…"}`, remove: () => update({ yearFrom: null, yearTo: null }) });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="mr-2 text-[15px]">
          <strong className="font-medium">{countLabel}</strong>
          {params.q && <span className="text-ink-muted"> {labels.forQuery.replace("{q}", params.q)}</span>}
        </span>
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={chip.remove}
            aria-label={labels.removeFilter.replace("{name}", chip.label)}
            className="inline-flex h-9 animate-swap items-center gap-2 border border-ink px-3 text-sm hover:bg-ink hover:text-paper"
          >
            {chip.label}
            <X aria-hidden size={14} strokeWidth={1.5} />
          </button>
        ))}
        {(hasFilters(params) || params.q) && (
          <button
            type="button"
            onClick={() => update({ q: "", category: [], language: [], author: [], available: false, yearFrom: null, yearTo: null })}
            className="eyebrow h-9 px-2 text-plum-500 underline underline-offset-5 hover:text-plum-700"
          >
            {labels.clearAll}
          </button>
        )}
      </div>

      <div className="flex items-center gap-5">
        <label className="flex items-center gap-2.5 text-sm text-ink-muted">
          {labels.sort}
          <span className="relative inline-flex">
            <select
              value={params.sort}
              onChange={(e) => update({ sort: e.target.value as CatalogParams["sort"] })}
              className="h-10 appearance-none rounded-xs border border-line bg-paper-3 pr-9 pl-3 text-sm text-ink"
            >
              {(Object.keys(labels.sorts) as CatalogParams["sort"][]).map((s) => (
                <option key={s} value={s}>
                  {labels.sorts[s]}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden size={16} strokeWidth={1.5} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink" />
          </span>
        </label>
        <div role="group" aria-label={labels.view} className="hidden border border-line sm:inline-flex">
          {(["grid", "list"] as const).map((view) => {
            const Icon = view === "grid" ? LayoutGrid : List;
            const active = params.view === view;
            return (
              <button
                key={view}
                type="button"
                aria-label={view === "grid" ? labels.gridView : labels.listView}
                aria-pressed={active}
                onClick={() => update({ view, page: params.page })}
                className={`inline-flex size-10 items-center justify-center ${active ? "bg-ink text-paper" : "text-ink hover:bg-paper-2"}`}
              >
                <Icon aria-hidden size={18} strokeWidth={1.5} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
