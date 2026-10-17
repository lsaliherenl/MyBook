"use client";

import { CircleAlert, FileUp, Printer, ScanBarcode, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import type { CoverCandidate, ExternalBookCandidate, ImportIsbnResultDto, ImportSearchResult } from "@mybook/shared";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import { addCopies, importBook, importIsbn, loadBook, searchSources } from "../books/actions";

type Text = Dictionary["admin"]["import"];
type Errors = Dictionary["admin"]["bookErrors"];

const PROVIDER: Record<string, string> = { GOOGLE_BOOKS: "Google Books", OPEN_LIBRARY: "Open Library", APPLE_BOOKS: "Apple Books" };
const FIELD = "h-11.5 w-full rounded-xs border border-line bg-paper px-3.5 text-[15px] font-normal text-ink outline-none focus:border-plum-500";
const LABEL = "flex flex-col gap-1.5 text-[13px] font-medium";
const MAX_ROWS = 500;

const isIsbn = (value: string) => /^(97[89])?\d{9}[\dX]$/i.test(value.replace(/[\s-]/g, ""));
const fullness = (c: ExternalBookCandidate) => (c.authors.length ? 4 : 0) + (c.publisher ? 1 : 0) + (c.publishedYear ? 1 : 0) + (c.pageCount ? 1 : 0) + (c.description ? 2 : 0);
/** Apple's artwork is the sharpest, then Open Library; Google often only has a thumbnail. */
const coverRank = (c: CoverCandidate) => (c.provider === "APPLE_BOOKS" ? 3000 : c.provider === "OPEN_LIBRARY" ? 2000 : 1000) + (c.width ?? 0) / 10;

interface Saved {
  bookId: string;
  title: string;
  barcodes: string[];
  coverError: string | null;
}

interface Row {
  line: number;
  isbn: string;
  copies: number;
  shelf: string | null;
  result: ImportIsbnResultDto | null;
}

/** B16. Single book: search, pick the edition, check the details, choose a cover, set copies. Bulk: a CSV of ISBNs. */
export function ImportWorkspace({
  locale,
  initialQuery,
  text: t,
  fields: f,
  errors,
  categories,
  languages,
}: {
  locale: Locale;
  initialQuery: string;
  text: Text;
  fields: Dictionary["admin"]["book"];
  errors: Errors;
  categories: { id: string; name: string }[];
  languages: { code: string; name: string }[];
}) {
  const [tab, setTab] = useState<"single" | "bulk">("single");
  const [pending, startTransition] = useTransition();

  // Single book
  const [query, setQuery] = useState(initialQuery);
  const [found, setFound] = useState<ImportSearchResult | null>(null);
  const [edition, setEdition] = useState(0);
  const [cover, setCover] = useState<string | null>(null);
  const [chosenCategories, setChosenCategories] = useState<string[]>([]);
  const [copies, setCopies] = useState(1);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Bulk
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const stop = useRef(false);

  const candidates = useMemo(() => [...(found?.candidates ?? [])].sort((a, b) => fullness(b) - fullness(a)), [found]);
  const covers = useMemo(() => {
    const seen = new Set<string>();
    return [...candidates.flatMap((c) => c.covers), ...(found?.extraCovers ?? [])].filter((c) => !seen.has(c.url) && seen.add(c.url)).sort((a, b) => coverRank(b) - coverRank(a));
  }, [candidates, found]);
  const picked = candidates[edition] ?? null;

  function search(value: string) {
    if (value.trim().length < 2) return;
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const result = await searchSources(value);
      if (!result.ok) {
        setFound(null);
        return setError(errors[result.error as keyof Errors] ?? errors.unknown);
      }
      const sorted = [...result.data.candidates].sort((a, b) => fullness(b) - fullness(a));
      const seen = new Set<string>();
      const best = [...sorted.flatMap((c) => c.covers), ...result.data.extraCovers].filter((c) => !seen.has(c.url) && seen.add(c.url)).sort((a, b) => coverRank(b) - coverRank(a))[0];
      setFound(result.data);
      setEdition(0);
      setCover(best?.url ?? null);
      setChosenCategories([]);
    });
  }

  function save(form: FormData) {
    if (!picked) return;
    const get = (name: string) => String(form.get(name) ?? "").trim();
    const num = (name: string) => (get(name) && Number.isFinite(Number(get(name))) ? Math.trunc(Number(get(name))) : null);
    const shelfLocation = get("shelf") || null;
    const chosenCover = covers.find((c) => c.url === cover) ?? null;
    setError(null);
    startTransition(async () => {
      let bookId: string;
      let coverError: string | null = null;
      if (found?.existingBookId) {
        const result = await addCopies(found.existingBookId, { count: copies, shelfLocation });
        if (!result.ok) return setError(errors[result.error as keyof Errors] ?? errors.unknown);
        bookId = found.existingBookId;
      } else {
        const result = await importBook({
          title: get("title"),
          subtitle: get("subtitle") || null,
          authors: get("authors").split(",").map((a) => a.trim()).filter(Boolean),
          publisher: get("publisher") || null,
          publishedYear: num("year"),
          pageCount: num("pages"),
          language: get("language"),
          description: get("description") || null,
          isbn13: get("isbn13").replace(/[^0-9]/g, "") || null,
          isbn10: get("isbn10").replace(/[^0-9X]/gi, "").toUpperCase() || null,
          categoryIds: chosenCategories,
          cover: chosenCover ? { url: chosenCover.url, provider: chosenCover.provider } : null,
          externalIds: {
            googleVolumeId: candidates.find((c) => c.provider === "GOOGLE_BOOKS")?.externalId ?? null,
            openLibraryId: candidates.find((c) => c.provider === "OPEN_LIBRARY")?.externalId ?? null,
            appleTrackId: candidates.find((c) => c.provider === "APPLE_BOOKS")?.externalId ?? null,
          },
          copies: { count: copies, shelfLocation },
        });
        if (!result.ok) return setError(errors[result.error as keyof Errors] ?? errors.unknown);
        bookId = result.data.book.id;
        coverError = result.data.coverError;
      }
      const book = await loadBook(bookId);
      const all = book.ok ? book.data.copies.map((c) => c.barcode) : [];
      setSaved({ bookId, title: book.ok ? book.data.title : get("title"), barcodes: all.slice(-copies), coverError });
    });
  }

  function reset() {
    setFound(null);
    setSaved(null);
    setQuery("");
    setCopies(1);
    setError(null);
  }

  // ─── Bulk ──────────────────────────────────────────────────────────────────

  async function readFile(file: File) {
    const lines = (await file.text()).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsed: Row[] = [];
    lines.forEach((line, i) => {
      const [isbn = "", count = "", shelf = ""] = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
      if (i === 0 && /isbn/i.test(isbn)) return; // header row
      if (!isbn) return;
      parsed.push({ line: i + 1, isbn, copies: Math.min(50, Math.max(1, Number(count) || 1)), shelf: shelf || null, result: null });
    });
    setFileName(file.name);
    setRows(parsed.slice(0, MAX_ROWS));
    setError(parsed.length === 0 ? t.bulkEmpty : parsed.length > MAX_ROWS ? t.bulkTooMany : null);
  }

  async function runBulk() {
    stop.current = false;
    setRunning(true);
    for (let i = 0; i < rows.length; i++) {
      if (stop.current) break;
      if (rows[i].result) continue;
      const row = rows[i];
      const result = await importIsbn({ isbn: row.isbn, copies: row.copies, shelfLocation: row.shelf });
      const value: ImportIsbnResultDto = result.ok ? result.data : { isbn: row.isbn, status: "failed", bookId: null, title: null };
      setRows((list) => list.map((r, j) => (j === i ? { ...r, result: value } : r)));
    }
    setRunning(false);
  }

  const done = rows.filter((r) => r.result);
  const tally = {
    ok: done.filter((r) => r.result!.status === "imported" || r.result!.status === "copies_added").length,
    review: done.filter((r) => r.result!.status === "no_cover").length,
    failed: done.filter((r) => ["not_found", "invalid", "failed"].includes(r.result!.status)).length,
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const tabButton = (key: "single" | "bulk", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === key}
      onClick={() => setTab(key)}
      className={`-mb-px h-13 border-b-2 text-base ${tab === key ? "border-plum-700 text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-line px-3.5 pt-7 sm:px-10 print:hidden">
        <div className="flex flex-col gap-1.5 pb-4.5">
          <span className="eyebrow text-[10px] text-plum-500">{t.eyebrow}</span>
          <h1 className="m-0 animate-rise font-serif text-[40px] leading-none font-light sm:text-[48px]">{t.title}</h1>
        </div>
        <div role="tablist" aria-label={t.tabsLabel} className="flex gap-8">
          {tabButton("single", t.single)}
          {tabButton("bulk", t.bulk)}
        </div>
      </div>
      <main className="flex flex-col gap-7 px-3.5 pt-8 pb-12 sm:px-10">{tab === "single" ? single() : bulk()}</main>
    </>
  );

  // Render helpers (called, not mounted, so inputs keep their state between renders).

  function single() {
    if (saved) return savedPanel(saved);
    return (
      <>
        <section aria-labelledby="h-find" className="flex animate-swap flex-col gap-3 print:hidden">
          <h2 id="h-find" className="eyebrow m-0 text-[10px] text-ink-muted">
            {t.step1}
          </h2>
          <form
            className="flex flex-wrap gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              search(query);
            }}
          >
            <div className="flex h-17 min-w-0 flex-[1_1_420px] items-center gap-3.5 border border-line bg-paper-3 pr-2 pl-5 focus-within:border-plum-500">
              <ScanBarcode aria-hidden size={24} strokeWidth={1.5} className="flex-none text-ink-muted" />
              <label htmlFor="imp-q" className="sr-only">
                {t.searchLabel}
              </label>
              <input
                id="imp-q"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                autoComplete="off"
                placeholder={t.searchLabel}
                className="min-w-0 flex-1 border-0 bg-transparent font-serif text-[22px] tracking-[.03em] text-ink outline-none placeholder:text-ink-muted/60 sm:text-[26px]"
              />
              {isIsbn(query) && <span className="eyebrow hidden bg-paper-2 px-2 py-1 text-[9px] sm:inline">{t.isbnDetected}</span>}
              <button type="submit" disabled={pending} className="eyebrow inline-flex h-13 items-center gap-2 bg-plum-700 px-5.5 text-[11px] text-paper hover:bg-plum-900 disabled:opacity-60">
                <Search aria-hidden size={16} strokeWidth={1.5} />
                {t.search}
              </button>
            </div>
          </form>
          <span className="text-[13px] text-ink-muted">{pending && !found ? t.searching : t.searchHint}</span>
        </section>

        {error && (
          <p role="alert" className="m-0 border-l-2 border-overdue bg-overdue-bg px-4 py-3 text-[15px] text-overdue">
            {error}
          </p>
        )}
        {found && found.errors.length > 0 && (
          <p className="m-0 text-[13px] text-ink-muted">{format(t.sourceErrors, { providers: found.errors.map((e) => PROVIDER[e.provider]).join(", ") })}</p>
        )}
        {found && candidates.length === 0 && <p className="m-0 text-[15px] text-ink-muted">{t.noResults}</p>}

        {found?.existingBookId && (
          <div role="status" className="flex animate-swap flex-wrap items-center gap-x-5 gap-y-3 bg-ready-bg px-5 py-4 text-[15px] text-ready">
            <CircleAlert aria-hidden size={20} strokeWidth={1.5} />
            <span className="flex-1">
              <strong className="font-medium">{t.existsTitle}</strong> · {t.existsText}
            </span>
            <Link href={`/${locale}/admin/books/${found.existingBookId}`} className="eyebrow text-[10px] text-ready">
              {t.openRecord}
            </Link>
          </div>
        )}

        {picked && editions()}
        {picked && details()}
      </>
    );
  }

  function editions() {
    return (
      <section aria-labelledby="h-ed" className="flex animate-swap flex-col gap-3">
        <h2 id="h-ed" className="eyebrow m-0 text-[10px] text-ink-muted">
          {format(t.step2, { count: String(candidates.length) })}
        </h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5">
          {candidates.map((c, i) => {
            const on = i === edition;
            const meta = [c.publisher, c.publishedYear, c.pageCount ? format(t.pages, { count: String(c.pageCount) }) : null, c.language?.toUpperCase()].filter(Boolean).join(" · ");
            return (
              <button
                key={`${c.provider}-${c.externalId}`}
                type="button"
                aria-pressed={on}
                onClick={() => setEdition(i)}
                className={`flex gap-4 p-4.5 text-left text-ink ${on ? "border-2 border-plum-700 bg-paper-3" : "border border-line hover:border-ink"}`}
              >
                <span className="relative aspect-[2/3] w-12 flex-none overflow-hidden bg-paper-2 shadow-cover">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.covers[0] && <img src={c.covers[0].url} alt="" loading="lazy" className="size-full object-cover" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span lang="en" className="eyebrow self-start bg-paper-2 px-1.75 py-0.75 text-[9px]">{PROVIDER[c.provider]}</span>
                  <span className="font-serif text-[19px] leading-[1.15]">{c.title}</span>
                  <span className="text-[13px] text-ink-muted">{c.authors.join(", ") || t.noAuthors}</span>
                  <span className="text-[13px] text-ink-muted">{meta}</span>
                  {fullness(c) >= 8 && <span className="text-xs text-available">{t.fullRecord}</span>}
                </span>
                <span aria-hidden className={`inline-flex size-5 flex-none items-center justify-center rounded-full border ${on ? "border-plum-700" : "border-ink-muted"}`}>
                  {on && <span className="size-2.5 rounded-full bg-plum-700" />}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  function details() {
    const c = picked!;
    return (
      <form
        key={`${c.provider}-${c.externalId}`}
        onSubmit={(e) => {
          e.preventDefault();
          save(new FormData(e.currentTarget));
        }}
        className="flex animate-swap flex-col gap-7"
      >
        <section aria-labelledby="h-det" className="flex flex-wrap gap-7">
          <div className="flex flex-[2_1_520px] flex-col gap-4 border border-line bg-paper-3 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="h-det" className="eyebrow m-0 text-[10px] text-ink-muted">
                {t.step3}
              </h2>
              <span className="text-xs text-ink-muted">{format(t.filledFrom, { source: PROVIDER[c.provider] })}</span>
            </div>
            <div className="grid grid-cols-1 gap-x-4.5 gap-y-3.5 sm:grid-cols-2">
              <label className={`${LABEL} sm:col-span-2`}>
                {f.fieldTitle}
                <input name="title" required defaultValue={c.title} className={FIELD} />
              </label>
              <label className={LABEL}>
                {f.fieldAuthors}
                <input name="authors" required defaultValue={c.authors.join(", ")} className={FIELD} />
              </label>
              <label className={LABEL}>
                {f.fieldPublisher}
                <input name="publisher" defaultValue={c.publisher ?? ""} className={FIELD} />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className={LABEL}>
                  {f.fieldYear}
                  <input name="year" inputMode="numeric" defaultValue={c.publishedYear ?? ""} className={FIELD} />
                </label>
                <label className={LABEL}>
                  {f.fieldPages}
                  <input name="pages" inputMode="numeric" defaultValue={c.pageCount ?? ""} className={FIELD} />
                </label>
                <label className={LABEL}>
                  {f.fieldLanguage}
                  <select name="language" defaultValue={languages.some((l) => l.code === c.language) ? c.language! : "tr"} className={FIELD}>
                    {languages.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className={LABEL}>
                  {f.fieldIsbn13}
                  <input name="isbn13" defaultValue={c.isbn13 ?? ""} className={`${FIELD} tabular-nums`} />
                </label>
                <label className={LABEL}>
                  {f.fieldIsbn10}
                  <input name="isbn10" defaultValue={c.isbn10 ?? ""} className={`${FIELD} tabular-nums`} />
                </label>
              </div>
              <input type="hidden" name="subtitle" value={c.subtitle ?? ""} />
              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0 sm:col-span-2">
                <legend className="mb-1.5 text-[13px] font-medium">{f.fieldCategories}</legend>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const on = chosenCategories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        aria-pressed={on}
                        disabled={!on && chosenCategories.length >= 5}
                        onClick={() => setChosenCategories((list) => (on ? list.filter((x) => x !== cat.id) : [...list, cat.id]))}
                        className={`h-8.5 border px-3 text-[13px] disabled:opacity-40 ${on ? "border-ink bg-ink text-paper" : "border-line text-ink hover:border-ink"}`}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
                {c.rawCategories.length > 0 && <span className="text-xs text-ink-muted">{c.rawCategories.slice(0, 4).join(" · ")}</span>}
              </fieldset>
              <label className={`${LABEL} sm:col-span-2`}>
                {f.fieldDescription}
                <textarea name="description" rows={4} defaultValue={c.description ?? ""} className="w-full resize-y rounded-xs border border-line bg-paper px-3.5 py-3 text-[15px] leading-[1.55] font-normal text-ink outline-none focus:border-plum-500" />
              </label>
            </div>
          </div>

          <div className="flex flex-[1_1_320px] flex-col gap-5">
            <section aria-labelledby="h-cov" className="flex flex-col gap-3.5 border border-line bg-paper-3 p-6">
              <h2 id="h-cov" className="eyebrow m-0 text-[10px] text-ink-muted">
                {t.step4}
              </h2>
              <div className="grid grid-cols-2 gap-3.5">
                {covers.slice(0, 5).map((cv, i) => {
                  const on = cv.url === cover;
                  return (
                    <button
                      key={cv.url}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setCover(cv.url)}
                      className={`flex flex-col gap-2 p-2.5 text-left text-ink ${on ? "border-2 border-plum-700" : "border border-transparent hover:border-line"}`}
                    >
                      <span className="relative block aspect-[2/3] w-full overflow-hidden bg-paper-2 shadow-cover">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={cv.url} alt="" loading="lazy" className="size-full object-cover" />
                        {i === 0 && <span className="eyebrow absolute top-2 left-2 bg-plum-700 px-1.5 py-0.75 text-[8.5px] text-paper">{t.best}</span>}
                      </span>
                      <span className="text-xs tabular-nums">{cv.width && cv.height ? `${cv.width} × ${cv.height}` : " "}</span>
                      <span className="-mt-1.5 text-[11px] text-ink-muted">{PROVIDER[cv.provider]}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-pressed={cover === null}
                  onClick={() => setCover(null)}
                  className={`flex min-h-45 items-center justify-center p-2.5 text-[13px] text-ink-muted ${cover === null ? "border-2 border-plum-700" : "border border-dashed border-line hover:border-ink"}`}
                >
                  {t.noCoverOption}
                </button>
              </div>
            </section>

            <section aria-labelledby="h-cop" className="flex flex-col gap-3.5 border border-line bg-paper-3 p-6">
              <h2 id="h-cop" className="eyebrow m-0 text-[10px] text-ink-muted">
                {t.step5}
              </h2>
              <div className="flex items-end gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium">{t.newCopies}</span>
                  <span className="inline-flex border border-line">
                    <button type="button" aria-label={t.fewer} onClick={() => setCopies((n) => Math.max(1, n - 1))} className="size-11 bg-paper-3 text-lg text-ink">
                      −
                    </button>
                    <span aria-live="polite" className="inline-flex w-11 items-center justify-center border-x border-line text-[17px]">
                      {copies}
                    </span>
                    <button type="button" aria-label={t.more} onClick={() => setCopies((n) => Math.min(50, n + 1))} className="size-11 bg-paper-3 text-lg text-ink">
                      +
                    </button>
                  </span>
                </div>
                <label className={`${LABEL} flex-1`}>
                  {t.shelf}
                  <input name="shelf" maxLength={40} className={`${FIELD} tabular-nums`} />
                </label>
              </div>
              <span className="text-xs text-ink-muted">{t.barcodesNote}</span>
            </section>
          </div>
        </section>

        <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-5">
          <button type="submit" disabled={pending} className="eyebrow h-14 bg-plum-700 px-7 text-[11px] text-paper hover:bg-plum-900 disabled:opacity-60">
            {pending ? t.saving : format(found?.existingBookId ? t.saveCopies : t.save, { count: String(copies) })}
          </button>
        </div>
      </form>
    );
  }

  function savedPanel(s: Saved) {
    return (
      <>
        <section role="status" className="flex animate-swap flex-col items-start gap-4 bg-plum-700 p-6 text-cream sm:p-10 print:hidden">
          <span className="font-serif text-[34px] leading-tight sm:text-[40px]">{format(t.savedTitle, { title: s.title })}</span>
          {s.coverError && <span className="text-[15px] text-mauve-2">{format(t.savedCover, { reason: s.coverError })}</span>}
          <div className="flex flex-col gap-2">
            <span className="text-[13px] text-mauve-2">{t.savedBarcodes}</span>
            <span className="flex flex-wrap gap-1.5">
              {s.barcodes.map((b) => (
                <span key={b} className="bg-cream/10 px-2 py-1 text-[13px] tabular-nums">
                  {b}
                </span>
              ))}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            <button type="button" onClick={() => window.print()} className="eyebrow inline-flex h-12 items-center gap-2 bg-[#f3ece2] px-5 text-[11px] text-ink hover:bg-paper">
              <Printer aria-hidden size={16} strokeWidth={1.5} />
              {t.printLabels}
            </button>
            <Link href={`/${locale}/admin/books/${s.bookId}`} className="eyebrow inline-flex h-12 items-center border border-cream/50 px-5 text-[11px] text-cream no-underline hover:bg-cream/10">
              {t.openRecord}
            </Link>
            <button type="button" onClick={reset} className="eyebrow h-12 px-4 text-[11px] text-cream underline underline-offset-5">
              {t.importAnother}
            </button>
          </div>
        </section>
        <div className="hidden flex-wrap gap-3 print:flex">
          {s.barcodes.map((b) => (
            <span key={b} className="inline-flex flex-col items-center border border-black px-3.5 py-2.5 text-[13px] leading-[1.3] tabular-nums">
              <strong className="font-semibold">{b}</strong>
              <span>{s.title.slice(0, 24)}</span>
            </span>
          ))}
        </div>
      </>
    );
  }

  function bulk() {
    const template = `data:text/csv;charset=utf-8,${encodeURIComponent("isbn,copies,shelf\r\n9789750806978,2,TE-101\r\n")}`;
    const total = rows.length;
    const pct = (n: number) => (total ? `${(n / total) * 100}%` : "0%");
    return (
      <>
        <section className="flex animate-swap flex-col items-center gap-3 border border-dashed border-plum-500 bg-paper-3 px-5 py-10 text-center">
          <FileUp aria-hidden size={30} strokeWidth={1.25} className="text-plum-500" />
          <span className="font-serif text-[26px]">{fileName ?? t.bulkDrop}</span>
          <span className="text-sm text-ink-muted">
            {total ? format(t.bulkRows, { count: String(total) }) : t.bulkHelp}{" "}
            <a href={template} download="isbn-template.csv" className="text-ink underline underline-offset-3">
              {t.template}
            </a>
          </span>
          <div className="mt-1.5 flex flex-wrap justify-center gap-3">
            <label className="eyebrow inline-flex h-12 cursor-pointer items-center border border-ink px-5 text-[11px] text-ink hover:bg-ink hover:text-paper">
              {t.chooseFile}
              <input
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="sr-only"
                disabled={running}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void readFile(file);
                  e.target.value = "";
                }}
              />
            </label>
            {total > 0 &&
              (running ? (
                <button type="button" onClick={() => (stop.current = true)} className="eyebrow h-12 border border-overdue px-5 text-[11px] text-overdue">
                  {t.bulkStop}
                </button>
              ) : (
                done.length < total && (
                  <button type="button" onClick={runBulk} className="eyebrow h-12 bg-plum-700 px-5 text-[11px] text-paper hover:bg-plum-900">
                    {t.bulkStart}
                  </button>
                )
              ))}
          </div>
        </section>
        {error && <p className="m-0 text-sm text-overdue">{error}</p>}

        {total > 0 && (
          <section aria-labelledby="h-run" className="border border-line bg-paper-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-5">
              <div className="flex flex-col gap-1">
                <h2 id="h-run" className="m-0 font-serif text-[26px] font-normal">
                  {fileName}
                </h2>
                <span className="text-[13px] text-ink-muted" aria-live="polite">
                  {running ? format(t.bulkRunning, { done: String(done.length), total: String(total) }) : done.length === total ? t.bulkDone : format(t.bulkRows, { count: String(total) })}
                </span>
              </div>
              <div className="flex flex-wrap gap-2.5 text-[13px]">
                <span className="bg-available-bg px-2.5 py-1.25 text-available">{format(t.bulkImported, { count: String(tally.ok) })}</span>
                <span className="bg-ready-bg px-2.5 py-1.25 text-ready">{format(t.bulkReview, { count: String(tally.review) })}</span>
                <span className="bg-overdue-bg px-2.5 py-1.25 text-overdue">{format(t.bulkFailed, { count: String(tally.failed) })}</span>
              </div>
            </div>
            <div className="px-6">
              <div className="my-4.5 flex h-1.5 bg-paper-2">
                <span className="bg-available transition-[width]" style={{ width: pct(tally.ok) }} />
                <span className="bg-gold transition-[width]" style={{ width: pct(tally.review) }} />
                <span className="bg-overdue transition-[width]" style={{ width: pct(tally.failed) }} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="eyebrow border-b border-line px-6 py-2.5 text-[9.5px] font-medium text-ink-muted">{t.colRow}</th>
                    <th className="eyebrow border-b border-line px-2 py-2.5 text-[9.5px] font-medium text-ink-muted">{t.colIsbn}</th>
                    <th className="eyebrow border-b border-line px-2 py-2.5 text-[9.5px] font-medium text-ink-muted">{t.colResult}</th>
                    <th className="border-b border-line px-6 py-2.5">
                      <span className="sr-only">{t.colAction}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const status = r.result?.status ?? "pending";
                    const dot = { imported: "bg-available", copies_added: "bg-available", no_cover: "bg-gold", not_found: "bg-overdue", invalid: "bg-overdue", failed: "bg-overdue", pending: "bg-line" }[status];
                    return (
                      <tr key={r.line}>
                        <td className="border-b border-line px-6 py-3 text-ink-muted">{r.line}</td>
                        <td className="border-b border-line px-2 py-3 tabular-nums">{r.isbn}</td>
                        <td className="border-b border-line px-2 py-3">
                          <span className="inline-flex items-center gap-2">
                            <span aria-hidden className={`size-1.75 rounded-full ${dot}`} />
                            {t.results[status]}
                            {r.result?.title && <span className="text-ink-muted">· {r.result.title}</span>}
                          </span>
                        </td>
                        <td className="border-b border-line px-6 py-3 text-right">
                          {r.result?.bookId ? (
                            <Link href={`/${locale}/admin/books/${r.result.bookId}`} className="eyebrow inline-flex h-8.5 items-center border border-line px-3 text-[9.5px] text-ink no-underline hover:border-ink">
                              {t.openBook}
                            </Link>
                          ) : r.result?.status === "not_found" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setTab("single");
                                setQuery(r.isbn);
                                search(r.isbn);
                              }}
                              className="eyebrow h-8.5 border border-line px-3 text-[9.5px] text-ink hover:border-ink"
                            >
                              {t.enterManually}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </>
    );
  }
}
