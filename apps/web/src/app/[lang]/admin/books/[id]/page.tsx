import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { AdminBookDto, BookActivityDto } from "@mybook/shared";
import { AdminSearch } from "@/components/admin/admin-search";
import { AdminTopBar } from "@/components/admin/admin-top-bar";
import { FormMessage } from "@/components/form";
import type { Locale } from "@/i18n/config";
import { format, getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { api, ApiError } from "@/lib/api";
import { getCategories } from "@/lib/catalog";
import { formatMoney, languageName, localized } from "@/lib/format";
import { getStaff } from "@/lib/staff";
import { BookDetailsForm } from "./book-details-form";
import { CopiesPanel } from "./copies-panel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.admin.books.title };
}

const TABS = ["details", "copies", "activity"] as const;
type Tab = (typeof TABS)[number];

/** B15 record: the book's details, its copies one by one, and everything that happened to it. */
export default async function BookPage({ params, searchParams }: PageProps<"/[lang]/admin/books/[id]">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div aria-hidden className="m-10 h-96 animate-pulse bg-paper-2" />}>
      <BookView t={t} locale={locale} params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function BookView({
  t,
  locale,
  params,
  searchParams,
}: {
  t: Dictionary;
  locale: Locale;
  params: PageProps<"/[lang]/admin/books/[id]">["params"];
  searchParams: PageProps<"/[lang]/admin/books/[id]">["searchParams"];
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const tab: Tab = (TABS as readonly string[]).includes(String(query.tab)) ? (query.tab as Tab) : "copies";
  const k = t.admin.book;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  let book: AdminBookDto;
  try {
    book = await api<AdminBookDto>(`/admin/books/${id}`, { auth: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    return <FormMessage tone="error">{t.admin.apiUnavailable}</FormMessage>;
  }
  const [staff, categories, activity] = await Promise.all([
    getStaff(),
    getCategories(),
    tab === "activity" ? api<BookActivityDto[]>(`/admin/books/${id}/activity`, { auth: true }).catch(() => []) : Promise.resolve([]),
  ]);

  const circulating = book.copies.filter((c) => c.status !== "LOST" && c.status !== "WITHDRAWN");
  const count = (status: string) => book.copies.filter((c) => c.status === status).length;
  const base = `/${locale}/admin/books/${book.id}`;

  return (
    <>
      <AdminTopBar staff={{ name: staff.fullName, role: t.admin.roles[staff.role] }} languageLabel={t.nav.language}>
        <AdminSearch action={`/${locale}/admin/desk`} label={t.admin.search} placeholder={t.admin.searchPlaceholder} />
      </AdminTopBar>
      <div className="flex flex-col gap-5.5 border-b border-line px-3.5 pt-7 sm:px-10">
        <nav aria-label={k.breadcrumb} className="text-sm text-ink-muted">
          <Link href={`/${locale}/admin/books`} className="text-ink-muted hover:text-ink">
            {t.admin.books.title}
          </Link>{" "}
          <span aria-hidden>/</span>{" "}
          <span lang={book.language} aria-current="location" className="text-ink">
            {book.title}
          </span>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex items-end gap-6">
            <span className="relative aspect-[2/3] w-19 flex-none overflow-hidden bg-paper-2 shadow-cover">
              {book.cover && <Image src={book.cover.url} alt="" fill sizes="76px" className="object-cover" />}
            </span>
            <div className="flex flex-col gap-2">
              <h1 lang={book.language} className="m-0 font-serif text-[36px] leading-none font-light sm:text-[48px]">
                {book.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 text-[15px] text-ink-muted">
                <span>{[book.authors.join(", "), book.publishedYear].filter(Boolean).join(" · ")}</span>
                <Badge className="bg-stone-bg text-stone">{format(k.onShelf, { available: String(count("AVAILABLE")), total: String(circulating.length) })}</Badge>
                {count("ON_LOAN") > 0 && <Badge className="bg-loan-bg text-loan">{format(k.onLoan, { count: String(count("ON_LOAN")) })}</Badge>}
                {count("ON_HOLD") > 0 && <Badge className="bg-ready-bg text-ready">{format(k.onHold, { count: String(count("ON_HOLD")) })}</Badge>}
                {book.waiting > 0 && <Badge className="bg-ready-bg text-ready">{format(k.waiting, { count: String(book.waiting) })}</Badge>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5 pb-1">
            <Link href={`/${locale}/books/${book.slug}`} className="eyebrow inline-flex h-11.5 items-center border border-line px-4.5 text-[10px] text-ink no-underline hover:border-ink">
              {k.viewInCatalog}
            </Link>
            <Link href={`${base}?tab=copies#add-copies`} className="eyebrow inline-flex h-11.5 items-center border border-ink px-4.5 text-[10px] text-ink no-underline hover:bg-ink hover:text-paper">
              {k.addCopy}
            </Link>
            {tab === "details" && (
              <button type="submit" form="book-form" className="eyebrow h-11.5 bg-plum-700 px-5.5 text-[10px] text-paper hover:bg-plum-900">
                {k.save}
              </button>
            )}
          </div>
        </div>
        <nav aria-label={k.tabsLabel} className="flex gap-8">
          {TABS.map((key) => (
            <Link
              key={key}
              href={`${base}?tab=${key}`}
              aria-current={tab === key ? "page" : undefined}
              className={`-mb-px border-b-2 py-3.5 text-base no-underline ${tab === key ? "border-plum-700 text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}
            >
              {k.tabs[key]}
              {key === "copies" && <span className="ml-1.5 text-[13px] text-ink-muted">{book.copies.length}</span>}
            </Link>
          ))}
        </nav>
      </div>
      <main className="flex flex-col gap-7 px-3.5 pt-8 pb-12 sm:px-10">
        {tab === "details" && (
          <BookDetailsForm
            book={book}
            text={k}
            errors={t.admin.bookErrors}
            categories={categories.map((c) => ({ id: c.id, name: localized(c, "name", locale) }))}
            languages={[...new Set(["tr", "en", book.language])].map((code) => ({ code, name: languageName(code, locale) }))}
          />
        )}
        {tab === "copies" && <CopiesPanel book={book} text={k} errors={t.admin.bookErrors} locale={locale} />}
        {tab === "activity" && <Activity activity={activity} text={k} locale={locale} />}
      </main>
    </>
  );
}

const dayWithYear = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Istanbul" }).format(new Date(iso));

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`eyebrow inline-flex items-center rounded-xs px-2.25 py-1 text-[10px] whitespace-nowrap ${className}`}>{children}</span>;
}

const DOTS: Record<BookActivityDto["kind"], string> = {
  import: "bg-available",
  copies: "bg-available",
  edit: "bg-ink-muted",
  copy: "bg-ink-muted",
  checkout: "bg-plum-700",
  return: "bg-plum-500",
  reserve: "bg-gold",
};

function Activity({ activity, text, locale }: { activity: BookActivityDto[]; text: Dictionary["admin"]["book"]; locale: Locale }) {
  if (activity.length === 0) return <p className="m-0 text-[15px] text-ink-muted">{text.activityEmpty}</p>;
  const a = text.activity;
  const sentence = (item: BookActivityDto) => {
    const d = Object.fromEntries(Object.entries(item.data).map(([key, value]) => [key, value === null ? "" : String(value)]));
    if (item.kind === "return" && item.data.fine) return format(a.returnFine, { ...d, fine: formatMoney(Number(item.data.fine), locale) });
    return format(a[item.kind], { ...d, actor: item.actor ?? "" });
  };
  return (
    <ol className="m-0 flex max-w-205 list-none flex-col p-0">
      {activity.map((item, i) => (
        <li key={`${item.at}-${i}`} className="flex gap-5 border-b border-line py-4">
          <span className="w-27.5 flex-none text-sm text-ink-muted tabular-nums">{dayWithYear(item.at, locale)}</span>
          <span aria-hidden className={`mt-1.5 size-2.5 flex-none rounded-full ${DOTS[item.kind]}`} />
          <span className="flex flex-1 flex-col gap-0.75">
            <span className="text-[15px]">{sentence(item)}</span>
            <span className="text-[13px] text-ink-muted">{item.kind === "reserve" ? text.memberSite : item.actor ?? ""}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
