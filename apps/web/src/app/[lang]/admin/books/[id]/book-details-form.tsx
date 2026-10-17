"use client";

import { CircleCheck } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";
import type { AdminBookDto, CoverCandidate, UpdateBookInput } from "@mybook/shared";
import type { Dictionary } from "@/i18n/get-dictionary";
import { bulkBooks, replaceCover, saveBook, searchSources } from "../actions";

type Text = Dictionary["admin"]["book"];
type Errors = Dictionary["admin"]["bookErrors"];

const LABEL = "eyebrow text-[10px] text-ink-muted";
const FIELD = "h-11.5 w-full rounded-xs border border-line bg-paper-3 px-3.5 text-[15px] text-ink outline-none focus:border-plum-500";

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const optional = (form: FormData, name: string) => text(form, name) || null;
const number = (form: FormData, name: string) => {
  const value = Number(text(form, name));
  return text(form, name) && Number.isFinite(value) ? Math.trunc(value) : null;
};
const digits = (value: string | null) => value?.replace(/[^0-9X]/gi, "").toUpperCase() || null;

/** B15 "Details" tab: the catalog record, the cover and withdrawing the title. */
export function BookDetailsForm({
  book,
  text: k,
  errors,
  categories,
  languages,
}: {
  book: AdminBookDto;
  text: Text;
  errors: Errors;
  categories: { id: string; name: string }[];
  languages: { code: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [chosen, setChosen] = useState<string[]>(book.categoryIds);

  const fail = (code: string) => setMessage({ tone: "error", text: errors[code as keyof Errors] ?? errors.unknown });

  function save(form: FormData) {
    const input: UpdateBookInput = {
      title: text(form, "title"),
      subtitle: optional(form, "subtitle"),
      authors: text(form, "authors").split(",").map((a) => a.trim()).filter(Boolean),
      publisher: optional(form, "publisher"),
      isbn13: digits(optional(form, "isbn13")),
      isbn10: digits(optional(form, "isbn10")),
      publishedYear: number(form, "year"),
      pageCount: number(form, "pages"),
      language: text(form, "language"),
      description: optional(form, "description"),
      categoryIds: chosen,
    };
    setMessage(null);
    startTransition(async () => {
      const result = await saveBook(book.id, input);
      if (result.ok) setMessage({ tone: "ok", text: k.saved });
      else fail(result.error);
    });
  }

  return (
    <div className="flex animate-swap flex-wrap items-start gap-10">
      <form
        id="book-form"
        // onSubmit, not action: a form action resets the fields, which would drop edits the API refused.
        onSubmit={(event) => {
          event.preventDefault();
          save(new FormData(event.currentTarget));
        }}
        className="grid flex-[3_1_520px] grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-5 gap-y-4.5">
        {message && (
          <p
            role={message.tone === "error" ? "alert" : "status"}
            className={`col-span-full m-0 flex items-center gap-3 px-4.5 py-3.5 text-[15px] ${message.tone === "error" ? "bg-overdue-bg text-overdue" : "bg-available-bg text-available"}`}
          >
            {message.tone === "ok" && <CircleCheck aria-hidden size={20} strokeWidth={1.5} />}
            {message.text}
          </p>
        )}
        <Field label={k.fieldTitle} className="col-span-full">
          <input name="title" required maxLength={300} defaultValue={book.title} lang={book.language} className={FIELD} />
        </Field>
        <Field label={k.fieldSubtitle} className="col-span-full">
          <input name="subtitle" maxLength={300} defaultValue={book.subtitle ?? ""} className={FIELD} />
        </Field>
        <Field label={k.fieldAuthors} hint={k.authorsHint}>
          <input name="authors" required defaultValue={book.authors.join(", ")} className={FIELD} />
        </Field>
        <Field label={k.fieldPublisher}>
          <input name="publisher" maxLength={200} defaultValue={book.publisher ?? ""} className={FIELD} />
        </Field>
        <Field label={k.fieldIsbn13}>
          <input name="isbn13" inputMode="numeric" defaultValue={book.isbn13 ?? ""} className={`${FIELD} tabular-nums`} />
        </Field>
        <Field label={k.fieldIsbn10}>
          <input name="isbn10" defaultValue={book.isbn10 ?? ""} className={`${FIELD} tabular-nums`} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={k.fieldYear}>
            <input name="year" inputMode="numeric" defaultValue={book.publishedYear ?? ""} className={FIELD} />
          </Field>
          <Field label={k.fieldPages}>
            <input name="pages" inputMode="numeric" defaultValue={book.pageCount ?? ""} className={FIELD} />
          </Field>
        </div>
        <Field label={k.fieldLanguage}>
          <select name="language" defaultValue={book.language} className={FIELD}>
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <fieldset className="col-span-full m-0 flex flex-col gap-2 border-0 p-0">
          <legend className={`${LABEL} mb-2`}>
            {k.fieldCategories} <span className="normal-case tracking-normal">· {k.categoriesHint}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const on = chosen.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  disabled={!on && chosen.length >= 5}
                  onClick={() => setChosen((list) => (on ? list.filter((x) => x !== c.id) : [...list, c.id]))}
                  className={`h-9 border px-3.5 text-sm disabled:opacity-40 ${on ? "border-ink bg-ink text-paper" : "border-line text-ink hover:border-ink"}`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Field label={k.fieldDescription} className="col-span-full">
          <textarea name="description" rows={5} maxLength={10000} defaultValue={book.description ?? ""} className="w-full resize-y rounded-xs border border-line bg-paper-3 px-3.5 py-3 text-[15px] leading-[1.6] text-ink outline-none focus:border-plum-500" />
        </Field>
        <div className="col-span-full">
          <button type="submit" disabled={pending} className="eyebrow h-11.5 bg-plum-700 px-5.5 text-[10px] text-paper hover:bg-plum-900 disabled:opacity-60">
            {pending ? k.saving : k.save}
          </button>
        </div>
      </form>

      <aside className="flex max-w-85 flex-[1_1_260px] flex-col gap-4.5">
        <CoverCard book={book} text={k} errors={errors} />
        <Withdraw bookId={book.id} text={k} errors={errors} />
      </aside>
    </div>
  );
}

function Field({ label, hint, className = "", children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className={LABEL}>{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

function CoverCard({ book, text: k, errors }: { book: AdminBookDto; text: Text; errors: Errors }) {
  const [options, setOptions] = useState<CoverCandidate[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function find() {
    setMessage(null);
    startTransition(async () => {
      const result = await searchSources(book.isbn13 ?? `${book.title} ${book.authors[0] ?? ""}`);
      if (!result.ok) return setMessage(errors.unknown);
      const seen = new Set<string>();
      const covers = [...result.data.candidates.flatMap((c) => c.covers), ...result.data.extraCovers].filter((c) => !seen.has(c.url) && seen.add(c.url));
      setOptions(covers);
    });
  }

  function use(cover: CoverCandidate) {
    setMessage(null);
    startTransition(async () => {
      const result = await replaceCover(book.id, cover.url, cover.provider);
      if (result.ok) {
        setOptions(null);
        setMessage(k.coverSaved);
      } else setMessage(errors[result.error as keyof Errors] ?? errors.unknown);
    });
  }

  return (
    <div className="flex flex-col gap-4 border border-line bg-paper-3 p-5">
      <div className="flex items-start gap-4">
        <span className="relative aspect-[2/3] w-18 flex-none overflow-hidden bg-paper-2 shadow-cover">
          {book.cover && <Image src={book.cover.url} alt="" fill sizes="72px" className="object-cover" />}
        </span>
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow text-[10px]">{k.cover}</span>
          <span className="text-[13px] text-ink-muted">
            {book.cover ? [book.cover.width && book.cover.height ? `${book.cover.width} × ${book.cover.height}` : null, book.cover.source?.replace("_", " ").toLowerCase()].filter(Boolean).join(" · ") : k.noCover}
          </span>
          <button type="button" onClick={find} disabled={pending} className="eyebrow mt-1.5 h-9 self-start border border-ink px-3.5 text-[9px] text-ink hover:bg-ink hover:text-paper disabled:opacity-50">
            {pending && !options ? k.coverSearching : book.cover ? k.replaceCover : k.findCovers}
          </button>
        </div>
      </div>
      {message && <p className="m-0 text-[13px] text-ink-muted" role="status">{message}</p>}
      {options && (
        options.length === 0 ? (
          <p className="m-0 text-[13px] text-ink-muted">{k.coverNone}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {options.slice(0, 9).map((c) => (
              <button key={c.url} type="button" disabled={pending} onClick={() => use(c)} title={k.coverUse} className="flex flex-col gap-1 border border-transparent p-1 text-left hover:border-plum-500 disabled:opacity-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.url} alt="" loading="lazy" className="aspect-[2/3] w-full bg-paper-2 object-cover shadow-cover" />
                <span className="text-[10px] text-ink-muted">{c.provider.replace("_", " ").toLowerCase()}</span>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function Withdraw({ bookId, text: k, errors }: { bookId: string; text: Text; errors: Errors }) {
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2.5">
      {asking && <p className="m-0 text-[13px] text-overdue">{k.withdrawConfirm}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!asking) return setAsking(true);
          startTransition(async () => {
            const result = await bulkBooks({ bookIds: [bookId], withdraw: true });
            setAsking(false);
            setMessage(result.ok ? k.withdrawn : (errors[result.error as keyof Errors] ?? errors.unknown));
          });
        }}
        className="eyebrow h-11 border border-overdue text-[10px] text-overdue hover:bg-overdue hover:text-overdue-bg disabled:opacity-50"
      >
        {k.withdrawTitle}
      </button>
      {message && <p className="m-0 text-[13px] text-ink-muted" role="status">{message}</p>}
    </div>
  );
}
