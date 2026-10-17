import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountPageSkeleton } from "@/components/account/page-skeleton";
import Link from "next/link";
import { FAVORITES_LIST_ID, type ReadingListDetailDto, type ReadingListDto } from "@mybook/shared";
import { AvailabilityText } from "@/components/book-card";
import { BookCover } from "@/components/book-cover";
import { AddAvailableToBag, DeleteListButton, NewListButton, RemoveFromListButton, RenameListButton } from "@/components/lists/list-controls";
import { format, getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { api } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).lists.title, robots: { index: false } };
}

const listName = (list: { id: string; name: string }, t: Dictionary) => (list.id === FAVORITES_LIST_ID ? t.lists.favorites : list.name);

export default function ListsPage(props: PageProps<"/[lang]/account/lists">) {
  return (
    <Suspense fallback={<AccountPageSkeleton />}>
      <ListsPageContent {...props} />
    </Suspense>
  );
}

async function ListsPageContent({ searchParams }: PageProps<"/[lang]/account/lists">) {
  const [t, locale, params] = await Promise.all([getDictionary(), getLocale(), searchParams]);
  const lists = await api<ReadingListDto[]>("/me/lists", { auth: true });
  const activeId = lists.some((l) => l.id === params.list) ? String(params.list) : FAVORITES_LIST_ID;
  const active = await api<ReadingListDetailDto>(`/me/lists/${activeId}`, { auth: true });
  const l = t.lists;
  const count = (n: number) => (n === 1 ? l.countOne : format(l.count, { count: String(n) }));
  const available = active.books.filter((b) => b.availability.available > 0).map((b) => b.id);
  const name = listName(active, t);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-3.5">
          <span className="eyebrow text-plum-500">{l.eyebrow}</span>
          <h1 className="m-0 font-serif text-[44px] leading-[.98] font-light md:text-[clamp(52px,5vw,76px)] md:leading-[.96]">{l.title}</h1>
        </div>
        <NewListButton locale={locale} labels={{ newList: l.newList, name: l.newListName, create: l.create, cancel: l.cancel }} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))] sm:gap-6">
        {lists.map((list) => {
          const current = list.id === activeId;
          const covers = list.preview;
          return (
            <Link
              key={list.id}
              href={list.id === FAVORITES_LIST_ID ? "?" : `?list=${list.id}`}
              scroll={false}
              aria-current={current ? "true" : undefined}
              className={`group flex flex-col gap-3.5 border p-4 text-ink no-underline transition-colors sm:p-5.5 ${current ? "border-ink bg-paper-3" : "border-line hover:border-ink-muted"}`}
            >
              <span className="relative block h-26">
                {[0, 1, 2].map((i) => {
                  const book = covers[i];
                  const pos = ["left-0 bottom-0 -rotate-6", "left-[34px] bottom-1", "left-[70px] bottom-0 rotate-5"][i];
                  const hover = ["group-hover:-rotate-9 group-hover:-translate-x-1", "group-hover:-translate-y-1.5", "group-hover:rotate-8 group-hover:translate-x-1"][i];
                  return book ? (
                    <BookCover key={i} book={book} sizes="60px" className={`absolute! w-15 transition-transform duration-500 ease-out-soft ${pos} ${hover}`} />
                  ) : (
                    <span key={i} className={`absolute h-22.5 w-15 border border-dashed border-line bg-paper-2/60 ${pos}`} />
                  );
                })}
              </span>
              <span className="font-serif text-xl leading-[1.1] sm:text-2xl">{listName(list, t)}</span>
              <span className="flex justify-between text-[13px] text-ink-muted">
                <span>{count(list.bookCount)}</span>
                <span className="hidden sm:inline">{l.private}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <section aria-labelledby="h-list" className="flex flex-col gap-6 border-t border-line pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 id="h-list" className="m-0 font-serif text-[32px] font-normal md:text-[40px]">
            {name} <span className="text-lg text-ink-muted md:text-[22px]">· {count(active.books.length)}</span>
          </h2>
          <div className="flex flex-wrap items-center gap-5">
            {activeId !== FAVORITES_LIST_ID && (
              <>
                <RenameListButton listId={activeId} name={active.name} labels={{ rename: l.rename, save: l.save, cancel: l.cancel, name: l.newListName }} />
                <DeleteListButton listId={activeId} locale={locale} label={l.delete} confirmText={format(l.deleteConfirm, { name })} />
              </>
            )}
            {available.length > 0 && <AddAvailableToBag bookIds={available} label={format(l.addAvailable, { count: String(available.length) })} />}
          </div>
        </div>

        {active.books.length === 0 ? (
          <p className="m-0 max-w-120 text-ink-muted">{l.empty}</p>
        ) : (
          <div key={activeId} className="grid animate-swap grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:gap-x-7">
            {active.books.map((book) => (
              <div key={book.id} className="relative flex flex-col gap-1">
                <Link href={`/${locale}/books/${book.slug}`} className="block">
                  <BookCover book={book} sizes="170px" className="cover-lift mb-3 w-full" />
                </Link>
                <RemoveFromListButton listId={activeId} bookId={book.id} label={format(l.remove, { title: book.title })} />
                <Link href={`/${locale}/books/${book.slug}`} lang={book.language} className="font-serif text-[19px] leading-[1.12] text-ink no-underline hover:text-plum-500">
                  {book.title}
                </Link>
                <span className="text-[13px] text-ink-muted">{book.authors.map((a) => a.name).join(", ")}</span>
                <AvailabilityText book={book} t={t.book} locale={locale} className="mt-1 text-[9.5px]" />
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
