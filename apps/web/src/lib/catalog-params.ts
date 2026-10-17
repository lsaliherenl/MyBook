import { CATALOG_SORTS } from "@mybook/shared";

/** Catalog state as it lives in the URL: /tr/catalog?q=roman&category=history,philosophy&page=2 */
export interface CatalogParams {
  q: string;
  category: string[];
  language: string[];
  author: string[];
  available: boolean;
  yearFrom: number | null;
  yearTo: number | null;
  sort: (typeof CATALOG_SORTS)[number];
  page: number;
  view: "grid" | "list";
}

export const CATALOG_PAGE_SIZE = 12;

type RawParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const list = (v: string | string[] | undefined) => one(v).split(",").map((s) => s.trim()).filter(Boolean);
const year = (v: string | string[] | undefined) => {
  const n = Number.parseInt(one(v), 10);
  return Number.isFinite(n) && n > 0 && n < 3000 ? n : null;
};

export function parseCatalogParams(raw: RawParams): CatalogParams {
  const sort = one(raw.sort);
  const page = Number.parseInt(one(raw.page), 10);
  return {
    q: one(raw.q).trim().slice(0, 200),
    category: list(raw.category),
    language: list(raw.language).filter((l) => l.length === 2),
    author: list(raw.author),
    available: one(raw.available) === "true",
    yearFrom: year(raw.yearFrom),
    yearTo: year(raw.yearTo),
    sort: (CATALOG_SORTS as readonly string[]).includes(sort) ? (sort as CatalogParams["sort"]) : "relevance",
    page: Number.isFinite(page) && page > 1 ? page : 1,
    view: one(raw.view) === "list" ? "list" : "grid",
  };
}

/** URL search string for a catalog state; defaults are left out so links stay short. */
export function catalogSearch(p: CatalogParams): string {
  const s = new URLSearchParams();
  if (p.q) s.set("q", p.q);
  if (p.category.length) s.set("category", p.category.join(","));
  if (p.language.length) s.set("language", p.language.join(","));
  if (p.author.length) s.set("author", p.author.join(","));
  if (p.available) s.set("available", "true");
  if (p.yearFrom) s.set("yearFrom", String(p.yearFrom));
  if (p.yearTo) s.set("yearTo", String(p.yearTo));
  if (p.sort !== "relevance") s.set("sort", p.sort);
  if (p.page > 1) s.set("page", String(p.page));
  if (p.view === "list") s.set("view", "list");
  const str = s.toString().replaceAll("%2C", ",");
  return str ? `?${str}` : "";
}

/** The same state as API query parameters. */
export function catalogApiQuery(p: CatalogParams) {
  return {
    q: p.q || undefined,
    category: p.category.join(",") || undefined,
    language: p.language.join(",") || undefined,
    author: p.author.join(",") || undefined,
    available: p.available || undefined,
    yearFrom: p.yearFrom ?? undefined,
    yearTo: p.yearTo ?? undefined,
  };
}

export const hasFilters = (p: CatalogParams) =>
  p.category.length > 0 || p.language.length > 0 || p.author.length > 0 || p.available || Boolean(p.yearFrom) || Boolean(p.yearTo);

export const toggle = (values: string[], value: string) => (values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
