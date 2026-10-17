"use client";

import { Check, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { AdminBookRowDto } from "@mybook/shared";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import { localized } from "@/lib/format";
import { bulkBooks } from "./actions";

type Text = Dictionary["admin"]["books"];
type Mode = null | "shelf" | "category" | "withdraw";

const TH = "eyebrow border-b border-ink px-3.5 pb-3 text-left text-[10px] font-medium whitespace-nowrap text-ink-muted";
const TD = "border-b border-line px-3.5 py-3.5 align-middle";

/** Spine label code: first three letters of the first author's surname, as on the design's label. */
export function spineCode(row: { authors: { name: string }[] }) {
  const surname = row.authors[0]?.name.trim().split(/\s+/).at(-1) ?? "";
  return surname.slice(0, 3).toLocaleUpperCase("tr");
}

/** B15 table: tick titles to move them to another shelf, recategorise, print labels or withdraw them. */
export function BooksTable({
  rows,
  locale,
  text,
  errors,
  categories,
}: {
  rows: AdminBookRowDto[];
  locale: Locale;
  text: Text;
  errors: Dictionary["admin"]["bookErrors"];
  categories: { id: string; name: string }[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>(null);
  const [shelf, setShelf] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = selected.filter((id) => rows.some((r) => r.id === id));
  const allOn = rows.length > 0 && rows.every((r) => selected.includes(r.id));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = () => setSelected((s) => (allOn ? s.filter((id) => !rows.some((r) => r.id === id)) : [...new Set([...s, ...rows.map((r) => r.id)])]));

  function apply(change: { shelfLocation?: string; categoryId?: string; withdraw?: true }) {
    setMessage(null);
    startTransition(async () => {
      const result = await bulkBooks({ bookIds: visible, ...change });
      if (result.ok) {
        setMessage({ tone: "ok", text: format(text.bulkDone, { count: String(result.data.changed) }) });
        setMode(null);
        setSelected([]);
      } else {
        setMessage({ tone: "error", text: errors[result.error as keyof typeof errors] ?? errors.unknown });
      }
    });
  }

  const barButton = "eyebrow h-9.5 border border-paper/40 px-4 text-[10px] text-paper hover:bg-paper/10 disabled:opacity-50";
  const field = "h-9.5 min-w-0 rounded-xs border border-paper/40 bg-transparent px-3 text-sm text-paper";

  return (
    <>
      {visible.length > 0 && (
        <div role="region" aria-label={text.selected} className="flex animate-swap flex-wrap items-center gap-x-5 gap-y-2.5 bg-plum-900 py-3 pr-3 pl-5 text-paper print:hidden">
          <span className="flex-1 text-[15px]">{visible.length === 1 ? text.oneSelected : format(text.selected, { count: String(visible.length) })}</span>
          {mode === "shelf" ? (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (shelf.trim()) apply({ shelfLocation: shelf.trim() });
              }}
            >
              <label className="sr-only" htmlFor="bulk-shelf">
                {text.shelfPrompt}
              </label>
              <input id="bulk-shelf" autoFocus value={shelf} onChange={(e) => setShelf(e.target.value)} placeholder={text.shelfPrompt} className={`${field} w-48 placeholder:text-paper/60`} />
              <button type="submit" disabled={pending} className={barButton}>
                {text.apply2}
              </button>
              <button type="button" onClick={() => setMode(null)} className={barButton}>
                {text.cancel}
              </button>
            </form>
          ) : mode === "category" ? (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (categoryId) apply({ categoryId });
              }}
            >
              <label className="sr-only" htmlFor="bulk-category">
                {text.categoryPrompt}
              </label>
              <select id="bulk-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${field} [&>option]:text-ink`}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={pending} className={barButton}>
                {text.apply2}
              </button>
              <button type="button" onClick={() => setMode(null)} className={barButton}>
                {text.cancel}
              </button>
            </form>
          ) : mode === "withdraw" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="max-w-110 text-sm text-overdue-bg">{text.withdrawConfirm}</span>
              <button type="button" disabled={pending} onClick={() => apply({ withdraw: true })} className={`${barButton} text-overdue-bg`}>
                {text.withdraw}
              </button>
              <button type="button" onClick={() => setMode(null)} className={barButton}>
                {text.cancel}
              </button>
            </div>
          ) : (
            <>
              <button type="button" onClick={() => setMode("shelf")} className={barButton}>
                {text.moveShelf}
              </button>
              <button type="button" onClick={() => setMode("category")} className={barButton}>
                {text.changeCategory}
              </button>
              <button type="button" onClick={() => window.print()} className={barButton}>
                {text.printLabels}
              </button>
              <button type="button" onClick={() => setMode("withdraw")} className={`${barButton} text-overdue-bg`}>
                {text.withdraw}
              </button>
            </>
          )}
          <button type="button" onClick={() => setSelected([])} aria-label={text.clearSelection} className="inline-flex size-9.5 items-center justify-center text-paper">
            <X aria-hidden size={18} strokeWidth={1.5} />
          </button>
        </div>
      )}
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`m-0 border-l-2 px-4 py-3 text-sm ${message.tone === "error" ? "border-overdue bg-overdue-bg text-overdue" : "border-available bg-available-bg text-available"}`}>
          {message.text}
        </p>
      )}

      {rows.length > 0 && (
        <div className="-mt-2 overflow-x-auto print:hidden">
          <table className="w-full min-w-240 border-collapse text-[15px]">
            <thead>
              <tr>
                <th className={`${TH} w-7 pr-0`}>
                  <CheckBox on={allOn} label={text.selectAll} onClick={toggleAll} />
                </th>
                <th className={TH}>{text.colTitle}</th>
                <th className={TH}>{text.colIsbn}</th>
                <th className={TH}>{text.colCategory}</th>
                <th className={TH}>{text.colShelf}</th>
                <th className={`${TH} text-right`}>{text.colTotal}</th>
                <th className={`${TH} text-right`}>{text.colAvailable}</th>
                <th className={`${TH} text-right`}>{text.colLoan}</th>
                <th className={`${TH} text-right`}>{text.colReserved}</th>
                <th className={TH}>
                  <span className="sr-only">{text.colActions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const on = selected.includes(r.id);
                const avail = r.available === 0 ? "bg-overdue-bg text-overdue" : r.available === 1 ? "bg-ready-bg text-ready" : "bg-available-bg text-available";
                const editHref = `/${locale}/admin/books/${r.id}`;
                return (
                  <tr key={r.id} className={`${on ? "bg-[#efe4e8]" : "hover:bg-paper-3"}`}>
                    <td className={`${TD} pr-0`}>
                      <CheckBox on={on} label={format(text.selectOne, { title: r.title })} onClick={() => toggle(r.id)} />
                    </td>
                    <td className={TD}>
                      <Link href={editHref} className="flex items-center gap-3.5 text-ink no-underline">
                        <span className="relative aspect-[2/3] w-8.5 flex-none overflow-hidden bg-paper-2 shadow-cover">
                          {r.coverUrl && <Image src={r.coverUrl} alt="" fill sizes="34px" className="object-cover" />}
                        </span>
                        <span className="flex flex-col gap-0.5">
                          <span lang={r.language} className="font-serif text-[19px] leading-[1.15] hover:underline">
                            {r.title}
                          </span>
                          <span className="text-[13px] text-ink-muted">{[r.authors.map((a) => a.name).join(", "), r.publishedYear].filter(Boolean).join(" · ")}</span>
                        </span>
                      </Link>
                    </td>
                    <td className={`${TD} text-[13px] whitespace-nowrap text-ink-muted tabular-nums`}>{r.isbn13 ?? "—"}</td>
                    <td className={`${TD} text-sm`}>{r.categories.map((c) => localized(c, "name", locale)).join(", ") || "—"}</td>
                    <td className={`${TD} whitespace-nowrap tabular-nums`}>{r.shelves.join(", ") || "—"}</td>
                    <td className={`${TD} text-right tabular-nums`}>{r.total}</td>
                    <td className={`${TD} text-right`}>
                      <span className={`inline-flex rounded-xs px-2.25 py-1 text-xs font-medium tabular-nums ${avail}`}>{r.available}</span>
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>{r.onLoan}</td>
                    <td className={`${TD} text-right tabular-nums ${r.reserved ? "text-ready" : "text-ink-muted"}`}>{r.reserved}</td>
                    <td className={`${TD} text-right`}>
                      <Link href={editHref} className="eyebrow text-[10px] whitespace-nowrap text-ink hover:text-plum-500">
                        {text.edit}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Printed instead of the page when "Print spine labels" is used. */}
      <div className="hidden flex-wrap gap-3 print:flex">
        {rows
          .filter((r) => visible.includes(r.id))
          .map((r) => (
            <span key={r.id} className="inline-flex flex-col items-center border border-black px-3.5 py-2.5 text-[13px] leading-[1.3] tabular-nums">
              <strong className="font-semibold">{r.shelves[0] ?? "—"}</strong>
              <span>{spineCode(r)}</span>
              <span>{r.publishedYear ?? ""}</span>
            </span>
          ))}
      </div>
    </>
  );
}

function CheckBox({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex size-5 items-center justify-center rounded-xs border border-ink text-paper ${on ? "bg-plum-700" : "bg-transparent"}`}
    >
      {on && <Check aria-hidden size={14} strokeWidth={2} />}
    </button>
  );
}
