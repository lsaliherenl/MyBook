import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, Download, FileDown, Search } from "lucide-react";
import { ADMIN_BOOK_FILTERS, type AdminBookFilter, type AdminBookListDto } from "@mybook/shared";
import { AdminSearch } from "@/components/admin/admin-search";
import { AdminTopBar } from "@/components/admin/admin-top-bar";
import { AutoSubmitSelect } from "@/components/admin/auto-submit";
import { FormMessage } from "@/components/form";
import type { Locale } from "@/i18n/config";
import { format, getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { api } from "@/lib/api";
import { getCategories } from "@/lib/catalog";
import { formatNumber, localized } from "@/lib/format";
import { getStaff } from "@/lib/staff";
import { BooksTable } from "./books-table";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.admin.books.title };
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
const PAGE_SIZES = [25, 50, 100];

/** B15: every title with its copies — filter, select, change in bulk, open a record. */
export default async function BooksPage({ searchParams }: PageProps<"/[lang]/admin/books">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div aria-hidden className="m-10 h-96 animate-pulse bg-paper-2" />}>
      <Books t={t} locale={locale} searchParams={searchParams} />
    </Suspense>
  );
}

async function Books({ t, locale, searchParams }: { t: Dictionary; locale: Locale; searchParams: Promise<Params> }) {
  const params = await searchParams;
  const b = t.admin.books;
  const q = one(params.q);
  const category = one(params.category);
  const filter = (ADMIN_BOOK_FILTERS as readonly string[]).includes(one(params.filter)) ? (one(params.filter) as AdminBookFilter) : "all";
  const pageSize = PAGE_SIZES.includes(Number(one(params.size))) ? Number(one(params.size)) : 25;
  const page = Math.max(1, Number(one(params.page)) || 1);

  const query = new URLSearchParams({ filter, page: String(page), pageSize: String(pageSize) });
  if (q) query.set("q", q);
  if (category) query.set("category", category);
  const [staff, categories, list] = await Promise.all([
    getStaff(),
    getCategories(),
    api<AdminBookListDto>(`/admin/books?${query}`, { auth: true }).catch(() => null),
  ]);

  const base = `/${locale}/admin/books`;
  const href = (changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams();
    const merged = { q, category, filter, size: pageSize === 25 ? "" : String(pageSize), page: "", ...changes };
    for (const [key, value] of Object.entries(merged)) if (value && !(key === "filter" && value === "all")) next.set(key, String(value));
    const s = next.toString();
    return s ? `${base}?${s}` : base;
  };
  const exportQuery = new URLSearchParams({ filter });
  if (q) exportQuery.set("q", q);
  if (category) exportQuery.set("category", category);

  return (
    <>
      <AdminTopBar staff={{ name: staff.fullName, role: t.admin.roles[staff.role] }} languageLabel={t.nav.language}>
        <AdminSearch action={`/${locale}/admin/desk`} label={t.admin.search} placeholder={t.admin.searchPlaceholder} />
      </AdminTopBar>
      <main className="flex flex-col gap-7 px-3.5 py-10 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-5 print:hidden">
          <div className="flex flex-col gap-2">
            <span className="eyebrow text-[10px] text-plum-500">{b.eyebrow}</span>
            <h1 className="m-0 animate-rise font-serif text-[44px] leading-none font-light sm:text-[56px]">{b.title}</h1>
            {list && (
              <span className="text-[15px] text-ink-muted">
                {format(b.subtitle, { titles: formatNumber(list.catalog.titles, locale), copies: formatNumber(list.catalog.copies, locale) })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link href={`/${locale}/admin/import`} className="eyebrow inline-flex h-12 items-center gap-2.5 bg-plum-700 px-5 text-[11px] text-paper no-underline hover:bg-plum-900">
              <Download aria-hidden size={16} strokeWidth={1.5} />
              {b.import}
            </Link>
            <a
              href={`${base}/export.csv?${exportQuery}`}
              className="eyebrow inline-flex h-12 items-center gap-2.5 border border-ink px-5 text-[11px] text-ink no-underline hover:bg-ink hover:text-paper"
            >
              <FileDown aria-hidden size={16} strokeWidth={1.5} />
              {b.exportCsv}
            </a>
          </div>
        </div>

        <Form action={base} className="flex flex-wrap items-center gap-3 print:hidden" role="search">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          {pageSize !== 25 && <input type="hidden" name="size" value={pageSize} />}
          <div className="flex h-11.5 max-w-105 flex-[1_1_300px] items-center gap-3 rounded-xs border border-line bg-paper-3 px-3.5 focus-within:border-plum-500">
            <Search aria-hidden size={18} strokeWidth={1.5} className="flex-none text-ink-muted" />
            <label htmlFor="bk-q" className="sr-only">
              {b.filterLabel}
            </label>
            <input id="bk-q" name="q" type="search" defaultValue={q} placeholder={b.filterPlaceholder} className="min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-none" />
          </div>
          <label className="flex h-11.5 items-center gap-2.5 rounded-xs border border-line bg-paper-3 px-3.5 text-sm">
            <span className="eyebrow text-[9px] text-ink-muted">{b.category}</span>
            <AutoSubmitSelect name="category" defaultValue={category} className="border-0 bg-transparent text-[15px] text-ink outline-none">
              <option value="">{b.allCategories}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {localized(c, "name", locale)}
                </option>
              ))}
            </AutoSubmitSelect>
          </label>
          <button type="submit" className="eyebrow h-11.5 border border-ink px-4 text-[10px] text-ink hover:bg-ink hover:text-paper">
            {b.apply}
          </button>
        </Form>

        {list ? (
          <>
            <div role="group" aria-label={b.chipsLabel} className="-mt-3 flex flex-wrap gap-2 print:hidden">
              {ADMIN_BOOK_FILTERS.map((key) => {
                const on = key === filter;
                return (
                  <Link
                    key={key}
                    href={href({ filter: key })}
                    aria-current={on ? "true" : undefined}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm no-underline ${on ? "border-ink bg-ink text-paper" : "border-line text-ink hover:border-ink"}`}
                  >
                    {b.chips[key]} <span className="opacity-70">{formatNumber(list.counts[key], locale)}</span>
                  </Link>
                );
              })}
            </div>

            <BooksTable
              rows={list.items}
              locale={locale}
              text={b}
              errors={t.admin.bookErrors}
              categories={categories.map((c) => ({ id: c.id, name: localized(c, "name", locale) }))}
            />

            {list.items.length === 0 && (
              <div className="flex flex-col items-center gap-2.5 border border-dashed border-line px-5 py-12 text-center">
                <span className="font-serif text-[30px]">{b.emptyTitle}</span>
                <span className="text-[15px] text-ink-muted">{b.emptyText}</span>
              </div>
            )}

            <Pagination list={list} text={b} locale={locale} href={href} pageSize={pageSize} q={q} category={category} filter={filter} />
          </>
        ) : (
          <FormMessage tone="error">{t.admin.apiUnavailable}</FormMessage>
        )}
      </main>
    </>
  );
}

function Pagination({
  list,
  text,
  locale,
  href,
  pageSize,
  q,
  category,
  filter,
}: {
  list: AdminBookListDto;
  text: Dictionary["admin"]["books"];
  locale: Locale;
  href: (changes: Record<string, string | number | null>) => string;
  pageSize: number;
  q: string;
  category: string;
  filter: string;
}) {
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const from = list.total ? (list.page - 1) * list.pageSize + 1 : 0;
  const to = Math.min(list.total, list.page * list.pageSize);
  const near = [...new Set([1, list.page - 1, list.page, list.page + 1, pages])].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const arrow = "inline-flex size-10 items-center justify-center border";
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
      <span className="text-sm text-ink-muted">
        {format(text.showing, { from: formatNumber(from, locale), to: formatNumber(to, locale), total: formatNumber(list.total, locale) })}
      </span>
      {pages > 1 && (
        <nav aria-label={text.pagination} className="flex items-center gap-1">
          {list.page > 1 ? (
            <Link href={href({ page: list.page - 1 })} aria-label={text.previous} className={`${arrow} border-ink text-ink`}>
              <ChevronLeft aria-hidden size={18} strokeWidth={1.5} />
            </Link>
          ) : (
            <span aria-hidden className={`${arrow} border-line text-ink-muted`}>
              <ChevronLeft size={18} strokeWidth={1.5} />
            </span>
          )}
          {near.map((p, i) => (
            <span key={p} className="flex items-center">
              {i > 0 && p - near[i - 1] > 1 && <span className="w-7 text-center text-ink-muted">…</span>}
              {p === list.page ? (
                <span aria-current="page" className="inline-flex h-10 min-w-10 items-center justify-center bg-ink px-2 text-sm text-paper">
                  {formatNumber(p, locale)}
                </span>
              ) : (
                <Link href={href({ page: p })} className="inline-flex h-10 min-w-10 items-center justify-center px-2 text-sm text-ink no-underline hover:bg-paper-2">
                  {formatNumber(p, locale)}
                </Link>
              )}
            </span>
          ))}
          {list.page < pages ? (
            <Link href={href({ page: list.page + 1 })} aria-label={text.next} className={`${arrow} border-ink text-ink`}>
              <ChevronRight aria-hidden size={18} strokeWidth={1.5} />
            </Link>
          ) : (
            <span aria-hidden className={`${arrow} border-line text-ink-muted`}>
              <ChevronRight size={18} strokeWidth={1.5} />
            </span>
          )}
        </nav>
      )}
      <Form action={`/${locale}/admin/books`} className="flex items-center gap-2.5 text-sm text-ink-muted">
        {q && <input type="hidden" name="q" value={q} />}
        {category && <input type="hidden" name="category" value={category} />}
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        <label htmlFor="bk-size">{text.rowsPerPage}</label>
        <AutoSubmitSelect id="bk-size" name="size" defaultValue={String(pageSize)} className="h-9 border border-line bg-paper-3 px-2 text-sm text-ink">
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </AutoSubmitSelect>
      </Form>
    </div>
  );
}
