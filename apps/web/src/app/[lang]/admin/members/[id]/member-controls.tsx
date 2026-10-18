"use client";

import { useState, useTransition } from "react";
import { ROLES, type FineDto, type MemberNoteDto, type Role } from "@mybook/shared";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatDay, formatMoney, formatShortDate } from "@/lib/format";
import { addMemberNote, cancelReservation, payFines, renewLoan, setMemberRole, setMemberStatus, waiveFine } from "../actions";

type Text = Dictionary["admin"]["member"];
type Errors = Dictionary["admin"]["memberErrors"];

const errorText = (errors: Errors, code: string) => errors[code as keyof Errors] ?? errors.unknown;

function Note({ message }: { message: { tone: "ok" | "error"; text: string } | null }) {
  if (!message) return null;
  return (
    <p role={message.tone === "error" ? "alert" : "status"} className={`m-0 text-[13px] ${message.tone === "error" ? "text-overdue" : "text-available"}`}>
      {message.text}
    </p>
  );
}

/** "Block borrowing" with a reason, or "Unblock" when the account is paused. */
export function BlockControl({ memberId, name, blocked, text: k, errors }: { memberId: string; name: string; blocked: boolean; text: Text; errors: Errors }) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState<keyof Text["reasons"]>("late");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function apply(status: "ACTIVE" | "BLOCKED") {
    setMessage(null);
    startTransition(async () => {
      const input = status === "BLOCKED" ? { status, reason: [k.reasons[reason], note.trim()].filter(Boolean).join(" · ") } : { status };
      const result = await setMemberStatus(memberId, input);
      if (result.ok) setAsking(false);
      else setMessage({ tone: "error", text: errorText(errors, result.error) });
    });
  }

  if (blocked) {
    return (
      <button type="button" disabled={pending} onClick={() => apply("ACTIVE")} className="eyebrow h-11.5 bg-available px-5 text-[10px] text-paper hover:opacity-90 disabled:opacity-60">
        {k.unblock}
      </button>
    );
  }
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="eyebrow h-11.5 border border-overdue px-4.5 text-[10px] text-overdue hover:bg-overdue hover:text-overdue-bg">
        {k.block}
      </button>
    );
  }
  return (
    <div role="dialog" aria-labelledby="blk-h" className="flex w-full animate-swap flex-col gap-3.5 border border-overdue bg-[#fbf1ec] px-6 py-5.5">
      <h2 id="blk-h" className="m-0 font-serif text-[26px] font-normal">
        {format(k.blockTitle, { name })}
      </h2>
      <span className="text-[15px] text-ink-muted">{k.blockText}</span>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(k.reasons) as (keyof Text["reasons"])[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={reason === key}
            onClick={() => setReason(key)}
            className={`h-9 rounded-full border px-3.5 text-sm ${reason === key ? "border-ink bg-ink text-paper" : "border-line text-ink hover:border-ink"}`}
          >
            {k.reasons[key]}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-2">
        <span className="eyebrow text-[10px] text-ink-muted">{k.blockNote}</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={k.blockNotePlaceholder} className="h-11 rounded-xs border border-line bg-paper-3 px-3.5 text-[15px] outline-none focus:border-plum-500" />
      </label>
      <div className="flex gap-2.5">
        <button type="button" disabled={pending} onClick={() => apply("BLOCKED")} className="eyebrow h-11 bg-overdue px-5 text-[10px] text-paper disabled:opacity-60">
          {k.block}
        </button>
        <button type="button" onClick={() => setAsking(false)} className="eyebrow h-11 border border-ink px-4.5 text-[10px] text-ink">
          {k.cancel}
        </button>
      </div>
      <Note message={message} />
    </div>
  );
}

export function RenewButton({ loanId, disabledReason, locale, text: k, errors }: { loanId: string; disabledReason: string | null; locale: Locale; text: Text; errors: Errors }) {
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        aria-disabled={Boolean(disabledReason)}
        title={disabledReason ?? undefined}
        disabled={pending}
        onClick={() => {
          if (disabledReason) return setMessage({ tone: "error", text: disabledReason });
          startTransition(async () => {
            const result = await renewLoan(loanId);
            setMessage(result.ok ? { tone: "ok", text: format(k.renewed, { date: formatDay(result.data.dueAt, locale) }) } : { tone: "error", text: errorText(errors, result.error) });
          });
        }}
        className={`eyebrow h-8 border border-line px-3 text-[9px] ${disabledReason ? "cursor-not-allowed text-[#b3a7ac]" : "text-ink hover:border-ink"}`}
      >
        {k.renew}
      </button>
      <Note message={message} />
    </span>
  );
}

export function CancelReservationButton({ reservationId, text: k, errors }: { reservationId: string; text: Text; errors: Errors }) {
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await cancelReservation(reservationId);
            setMessage(result.ok ? { tone: "ok", text: k.reservationCancelled } : { tone: "error", text: errorText(errors, result.error) });
          })
        }
        className="eyebrow h-8.5 border border-line px-3.5 text-[9px] text-ink hover:border-ink disabled:opacity-50"
      >
        {k.cancelReservation}
      </button>
      <Note message={message} />
    </span>
  );
}

/** Fines card: every fine with its state, and taking payment or waiving the open ones. */
export function FinesCard({ fines, accruing, locale, text: k, errors }: { fines: FineDto[]; accruing: number; locale: Locale; text: Text; errors: Errors }) {
  const [waiving, setWaiving] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const open = fines.filter((f) => f.status === "UNPAID");
  const total = open.reduce((sum, f) => sum + f.amount, 0);

  function pay() {
    startTransition(async () => {
      const result = await payFines(open.map((f) => f.id));
      setMessage(result.ok ? { tone: "ok", text: k.paid } : { tone: "error", text: errorText(errors, result.error) });
    });
  }

  function waive() {
    if (reason.trim().length < 3) return;
    startTransition(async () => {
      for (const f of open) {
        const result = await waiveFine(f.id, reason.trim());
        if (!result.ok) return setMessage({ tone: "error", text: errorText(errors, result.error) });
      }
      setWaiving(false);
      setMessage({ tone: "ok", text: k.waived });
    });
  }

  return (
    <section aria-labelledby="h-fines" className="flex flex-col gap-3.5 border border-line bg-paper-3 p-5.5">
      <div className="flex items-baseline justify-between">
        <h2 id="h-fines" className="eyebrow m-0 text-[11px]">
          {k.finesTitle}
        </h2>
        <span className={`font-serif text-[26px] ${total ? "text-overdue" : "text-available"}`}>{formatMoney(total, locale)}</span>
      </div>
      {fines.length === 0 && <p className="m-0 text-sm text-ink-muted">{k.noFines}</p>}
      {fines.map((f) => (
        <div key={f.id} className="flex justify-between gap-3 border-t border-line pt-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px]">{f.bookTitle}</span>
            <span className="text-xs text-ink-muted">
              {formatShortDate(f.issuedAt, locale)}
              {f.note ? ` · ${f.note}` : ""}
            </span>
          </span>
          <span className="flex flex-col items-end gap-0.5">
            <span className={`text-[15px] tabular-nums ${f.status === "UNPAID" ? "text-overdue" : "text-ink-muted"}`}>{formatMoney(f.amount, locale)}</span>
            <span className={`text-xs ${f.status === "UNPAID" ? "text-overdue" : "text-available"}`}>
              {f.status === "UNPAID" ? k.fineOpen : f.status === "PAID" ? format(k.finePaid, { date: f.paidAt ? formatShortDate(f.paidAt, locale) : "" }) : k.fineWaived}
            </span>
          </span>
        </div>
      ))}
      {open.length > 0 &&
        (waiving ? (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              {k.waiveNote}
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="h-10 rounded-xs border border-line bg-paper px-3 text-sm font-normal" />
            </label>
            <div className="flex gap-2">
              <button type="button" disabled={pending || reason.trim().length < 3} onClick={waive} className="eyebrow h-10 flex-1 bg-ink text-[10px] text-paper disabled:opacity-50">
                {k.waiveConfirm}
              </button>
              <button type="button" onClick={() => setWaiving(false)} className="eyebrow h-10 border border-ink px-3.5 text-[10px] text-ink">
                {k.cancel}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={pay} className="eyebrow h-10.5 flex-1 bg-plum-700 text-[10px] text-paper hover:bg-plum-900 disabled:opacity-60">
              {format(k.takePayment, { amount: formatMoney(total, locale) })}
            </button>
            <button type="button" onClick={() => setWaiving(true)} className="eyebrow h-10.5 border border-ink px-3.5 text-[10px] text-ink">
              {k.waive}
            </button>
          </div>
        ))}
      {accruing > 0 && <span className="text-xs text-ink-muted">{format(k.accruing, { amount: formatMoney(accruing, locale) })}</span>}
      <Note message={message} />
    </section>
  );
}

export function RoleControl({ memberId, role, editable, roles, text: k, errors }: { memberId: string; role: Role; editable: boolean; roles: Record<Role, string>; text: Text; errors: Errors }) {
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <section className="flex flex-col gap-3 border border-line bg-paper-3 p-5.5">
      <h2 className="eyebrow m-0 text-[11px]">{k.roleTitle}</h2>
      <select
        value={role}
        disabled={!editable || pending}
        aria-label={k.roleTitle}
        onChange={(e) =>
          startTransition(async () => {
            const result = await setMemberRole(memberId, e.target.value as Role);
            setMessage(result.ok ? { tone: "ok", text: k.roleSaved } : { tone: "error", text: errorText(errors, result.error) });
          })
        }
        className="h-10.5 rounded-xs border border-line bg-paper px-3 text-[15px] text-ink disabled:opacity-60"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {roles[r]}
          </option>
        ))}
      </select>
      {!editable && <span className="text-xs text-ink-muted">{k.roleHint}</span>}
      <Note message={message} />
    </section>
  );
}

export function NotesCard({ memberId, notes, locale, text: k, errors }: { memberId: string; notes: MemberNoteDto[]; locale: Locale; text: Text; errors: Errors }) {
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <section className="flex flex-col gap-3 border border-line bg-paper-3 p-5.5">
      <h2 className="eyebrow m-0 text-[11px]">{k.notesTitle}</h2>
      {notes.length === 0 && <p className="m-0 text-sm text-ink-muted">{k.noNotes}</p>}
      {notes.map((n) => (
        <div key={n.id} className="flex flex-col gap-1 border-t border-line pt-3">
          <span className="text-[15px] whitespace-pre-line">{n.text}</span>
          <span className="text-xs text-ink-muted">{[n.author, formatShortDate(n.at, locale)].filter(Boolean).join(" · ")}</span>
        </div>
      ))}
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim().length < 2) return;
          startTransition(async () => {
            const result = await addMemberNote(memberId, draft.trim());
            if (result.ok) setDraft("");
            else setMessage({ tone: "error", text: errorText(errors, result.error) });
          });
        }}
      >
        <textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={1000}
          aria-label={k.notePlaceholder}
          placeholder={k.notePlaceholder}
          className="resize-y border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-plum-500"
        />
        <button type="submit" disabled={pending || draft.trim().length < 2} className="eyebrow h-9.5 self-start border border-ink px-3.5 text-[10px] text-ink hover:bg-ink hover:text-paper disabled:opacity-50">
          {k.addNote}
        </button>
      </form>
      <Note message={message} />
    </section>
  );
}
