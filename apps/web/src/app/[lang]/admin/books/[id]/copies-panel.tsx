"use client";

import { Fragment, useState, useTransition } from "react";
import { COPY_CONDITIONS, MANUAL_COPY_STATUSES, type AdminBookDto, type AdminCopyDto, type CopyHistoryDto, type UpdateCopyInput } from "@mybook/shared";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatDay, formatMoney, formatShortDate } from "@/lib/format";
import { addCopies, copyHistory, updateCopy } from "../actions";

type Text = Dictionary["admin"]["book"];
type Errors = Dictionary["admin"]["bookErrors"];

const TH = "eyebrow border-b border-ink px-3.5 pb-3 text-left text-[10px] font-medium whitespace-nowrap text-ink-muted";
const TD = "border-b border-line px-3.5 py-3.5 align-middle";
const STATUS_TONE: Record<AdminCopyDto["status"], string> = {
  AVAILABLE: "bg-available-bg text-available",
  ON_HOLD: "bg-ready-bg text-ready",
  ON_LOAN: "bg-loan-bg text-loan",
  IN_REPAIR: "bg-stone-bg text-stone",
  LOST: "bg-overdue-bg text-overdue",
  WITHDRAWN: "bg-stone-bg text-stone",
};

/** B15 "Copies" tab: each copy's status, condition and shelf, its loan history, and adding copies. */
export function CopiesPanel({ book, text: k, errors, locale }: { book: AdminBookDto; text: Text; errors: Errors; locale: Locale }) {
  const [open, setOpen] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, CopyHistoryDto[]>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const fail = (code: string) => setMessage({ tone: "error", text: errors[code as keyof Errors] ?? errors.unknown });
  const no = (i: number) => String(i + 1).padStart(2, "0");

  function change(copyId: string, input: UpdateCopyInput) {
    setMessage(null);
    startTransition(async () => {
      const result = await updateCopy(copyId, input);
      if (result.ok) setMessage({ tone: "ok", text: k.copySaved });
      else fail(result.error);
    });
  }

  function toggleHistory(copyId: string) {
    if (open === copyId) return setOpen(null);
    setOpen(copyId);
    if (history[copyId]) return;
    startTransition(async () => {
      const result = await copyHistory(copyId);
      if (result.ok) setHistory((h) => ({ ...h, [copyId]: result.data }));
    });
  }

  function add(form: FormData) {
    const count = Number(form.get("count"));
    const shelfLocation = String(form.get("shelf") ?? "").trim() || null;
    setMessage(null);
    startTransition(async () => {
      const result = await addCopies(book.id, { count, shelfLocation });
      if (result.ok) setMessage({ tone: "ok", text: format(k.copiesAdded, { barcodes: result.data.barcodes.join(", ") }) });
      else fail(result.error);
    });
  }

  const holderLine = (c: AdminCopyDto) =>
    !c.holder
      ? null
      : c.holder.dueAt
        ? format(k.holderDue, { name: c.holder.memberName, date: formatDay(c.holder.dueAt, locale) })
        : format(k.holderHold, { name: c.holder.memberName, code: c.holder.reservationCode ?? "" });

  return (
    <div className="flex animate-swap flex-col gap-6">
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`m-0 border-l-2 px-4 py-3 text-sm ${message.tone === "error" ? "border-overdue bg-overdue-bg text-overdue" : "border-available bg-available-bg text-available"}`}>
          {message.text}
        </p>
      )}

      {book.copies.length === 0 ? (
        <p className="m-0 text-[15px] text-ink-muted">{k.noCopies}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-225 border-collapse text-[15px]">
            <thead>
              <tr>
                <th className={TH}>{k.colCopy}</th>
                <th className={TH}>{k.colBarcode}</th>
                <th className={TH}>{k.colStatus}</th>
                <th className={TH}>{k.colCondition}</th>
                <th className={TH}>{k.colShelf}</th>
                <th className={TH}>{k.colAcquired}</th>
                <th className={`${TH} text-right`}>{k.colLoans}</th>
                <th className={TH}>
                  <span className="sr-only">{k.colHistory}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {book.copies.map((c, i) => {
                const locked = c.status === "ON_LOAN" || c.status === "ON_HOLD";
                const statuses = locked ? [c.status] : MANUAL_COPY_STATUSES;
                return (
                  <Fragment key={c.id}>
                    <tr className="hover:bg-paper-3">
                      <td className={`${TD} font-serif text-[22px]`}>{no(i)}</td>
                      <td className={`${TD} tabular-nums`}>{c.barcode}</td>
                      <td className={TD}>
                        <div className="flex flex-col items-start gap-1">
                          {locked ? (
                            <span className={`eyebrow rounded-xs px-2.25 py-1 text-[10px] ${STATUS_TONE[c.status]}`}>{k.statuses[c.status]}</span>
                          ) : (
                            <select
                              aria-label={format(k.statusLabel, { no: no(i) })}
                              value={c.status}
                              disabled={pending}
                              onChange={(e) => change(c.id, { status: e.target.value as (typeof MANUAL_COPY_STATUSES)[number] })}
                              className={`eyebrow h-8 rounded-xs border-0 px-2 text-[10px] ${STATUS_TONE[c.status]}`}
                            >
                              {statuses.map((s) => (
                                <option key={s} value={s}>
                                  {k.statuses[s]}
                                </option>
                              ))}
                            </select>
                          )}
                          {holderLine(c) && <span className="text-[13px] text-ink-muted">{holderLine(c)}</span>}
                        </div>
                      </td>
                      <td className={TD}>
                        <select
                          aria-label={format(k.conditionLabel, { no: no(i) })}
                          value={c.condition}
                          disabled={pending}
                          onChange={(e) => change(c.id, { condition: e.target.value as AdminCopyDto["condition"] })}
                          className="h-9 border border-line bg-paper-3 px-2 text-sm text-ink"
                        >
                          {COPY_CONDITIONS.map((cond) => (
                            <option key={cond} value={cond}>
                              {k.conditions[cond]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={TD}>
                        <input
                          aria-label={format(k.shelfLabel, { no: no(i) })}
                          defaultValue={c.shelfLocation ?? ""}
                          maxLength={40}
                          onBlur={(e) => {
                            const value = e.target.value.trim() || null;
                            if (value !== c.shelfLocation) change(c.id, { shelfLocation: value });
                          }}
                          className="h-9 w-24 border border-transparent bg-transparent px-1.5 tabular-nums hover:border-line focus:border-plum-500 focus:bg-paper-3 focus:outline-none"
                        />
                      </td>
                      <td className={`${TD} text-sm text-ink-muted`}>{formatShortDate(c.acquiredAt, locale)} {new Date(c.acquiredAt).getUTCFullYear()}</td>
                      <td className={`${TD} text-right tabular-nums`}>{c.loanCount}</td>
                      <td className={`${TD} text-right`}>
                        <button
                          type="button"
                          aria-expanded={open === c.id}
                          onClick={() => toggleHistory(c.id)}
                          className="eyebrow h-8.5 border border-line px-3 text-[9px] whitespace-nowrap text-ink hover:border-ink"
                        >
                          {open === c.id ? k.hideHistory : k.history}
                        </button>
                      </td>
                    </tr>
                    {open === c.id && (
                      <tr>
                        <td colSpan={8} className="border-b border-line bg-paper-3 px-5.5 py-4">
                          <span className="eyebrow text-[10px] text-ink-muted">{format(k.historyTitle, { no: no(i), barcode: c.barcode })}</span>
                          <HistoryList entries={history[c.id]} text={k} locale={locale} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <form
        id="add-copies"
        onSubmit={(e) => {
          e.preventDefault();
          add(new FormData(e.currentTarget));
        }}
        className="flex scroll-mt-8 flex-wrap items-end gap-3.5 border border-line bg-paper-3 p-5"
      >
        <span className="eyebrow w-full text-[10px]">{k.addCopiesTitle}</span>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          {k.addCopiesCount}
          <input name="count" type="number" min={1} max={50} defaultValue={1} required className="h-11 w-24 border border-line bg-paper px-3 text-[15px] font-normal" />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          {k.addCopiesShelf}
          <input name="shelf" maxLength={40} defaultValue={book.copies.at(-1)?.shelfLocation ?? ""} className="h-11 w-36 border border-line bg-paper px-3 text-[15px] font-normal tabular-nums" />
        </label>
        <button type="submit" disabled={pending} className="eyebrow h-11 bg-plum-700 px-5 text-[10px] text-paper hover:bg-plum-900 disabled:opacity-60">
          {k.addCopiesButton}
        </button>
      </form>
    </div>
  );
}

function HistoryList({ entries, text: k, locale }: { entries: CopyHistoryDto[] | undefined; text: Text; locale: Locale }) {
  if (!entries) return <div aria-hidden className="mt-3 h-16 animate-pulse bg-paper-2" />;
  if (entries.length === 0) return <p className="m-0 mt-3 text-sm text-ink-muted">{k.historyEmpty}</p>;
  return (
    <ul className="m-0 mt-2 list-none p-0">
      {entries.map((h) => {
        const note = !h.returnedAt
          ? format(k.historyOut, { date: formatShortDate(h.dueAt, locale) })
          : h.daysOverdue > 0
            ? [format(k.historyLate, { days: String(h.daysOverdue) }), h.fine ? formatMoney(h.fine, locale) : null].filter(Boolean).join(" · ")
            : k.historyOnTime;
        const tone = !h.returnedAt ? "text-ink-muted" : h.daysOverdue > 0 ? "text-overdue" : "text-available";
        return (
          <li key={h.checkedOutAt} className="flex flex-wrap gap-x-6 gap-y-1.5 border-t border-line py-2 text-sm first:mt-2">
            <span className="w-37.5 text-ink-muted tabular-nums">
              {formatShortDate(h.checkedOutAt, locale)} – {h.returnedAt ? formatShortDate(h.returnedAt, locale) : "…"}
            </span>
            <span className="flex-[1_1_200px]">{h.memberName}</span>
            <span className={tone}>
              {note}
              {h.renewCount > 0 && ` · ${k.historyRenewed}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
