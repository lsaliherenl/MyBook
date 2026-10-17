"use client";

import { Check, CircleCheck, Package, Printer, ScanBarcode, Wrench, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import type {
  CheckoutManyResultDto,
  DeskCopyDto,
  DeskMemberDto,
  DeskMemberMatchDto,
  ReservationDto,
  ReturnCondition,
  ReturnResultDto,
} from "@mybook/shared";
import { AdminTopBar, type TopBarStaff } from "@/components/admin/admin-top-bar";
import { BookCover } from "@/components/book-cover";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatDay, formatMoney, formatTime, initials } from "@/lib/format";
import { useMounted } from "@/lib/use-mounted";
import { checkIn, checkOut, findMembers, loadMember, payFines, previewCopy, type DeskResult } from "./actions";

type Mode = "checkout" | "return";
type AdminText = Dictionary["admin"];

export interface DeskText {
  desk: AdminText["desk"];
  errors: AdminText["errors"];
  memberTypes: Dictionary["auth"]["memberTypes"];
  languageLabel: string;
}

interface Scanned {
  copy: DeskCopyDto;
  at: string;
}

interface Returned {
  result: ReturnResultDto;
  collected: boolean;
  condition: ReturnCondition;
}

const BLOCKING = ["member_blocked", "loan_overdue", "fines_over_limit"];
const SCAN_BOX = "flex h-19 min-w-0 flex-1 items-center gap-4 border-2 border-plum-500 bg-paper-3 px-5.5 shadow-[0_0_0_4px_var(--color-loan-bg)]";
const SCAN_INPUT = "min-w-0 flex-1 border-0 bg-transparent font-serif text-[26px] tracking-[.08em] text-ink uppercase outline-none placeholder:text-ink-muted/50 sm:text-[32px]";

/**
 * B14: the circulation desk. Check out: find the member, scan each copy (checked against their
 * reservations before anything is lent), confirm all at once. Return: scan, review the fine and
 * the next reader, confirm. F2 / F3 switch modes, Esc steps back.
 */
export function DeskWorkspace({
  text,
  locale,
  staff,
  canOverride,
  loanDays,
  initialMode,
  initialMember,
  initialMatches,
  initialQuery,
  initialCopy,
  side,
}: {
  text: DeskText;
  locale: Locale;
  staff: TopBarStaff;
  canOverride: boolean;
  loanDays: number;
  initialMode: Mode;
  initialMember: DeskMemberDto | null;
  initialMatches: DeskMemberMatchDto[] | null;
  initialQuery: string;
  initialCopy: DeskCopyDto | null;
  side: React.ReactNode;
}) {
  const d = text.desk;
  const [mode, setMode] = useState<Mode>(initialMode);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(initialQuery && initialMatches?.length === 0 ? format(d.noMatch, { q: initialQuery }) : null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scanFocused, setScanFocused] = useState(false);

  // Check out
  const [member, setMember] = useState<DeskMemberDto | null>(initialMember);
  const [matches, setMatches] = useState<DeskMemberMatchDto[] | null>(initialMatches && initialMatches.length > 1 ? initialMatches : null);
  const [scanned, setScanned] = useState<Scanned[]>([]);
  const [override, setOverride] = useState(false);
  const [done, setDone] = useState<CheckoutManyResultDto | null>(null);

  // Return
  const [copy, setCopy] = useState<DeskCopyDto | null>(initialCopy?.loan ? initialCopy : null);
  const [condition, setCondition] = useState<ReturnCondition>("same");
  const [returned, setReturned] = useState<Returned | null>(null);

  const scanInput = useRef<HTMLInputElement>(null);
  const mounted = useMounted();

  const refuse = (code: string) => setError(text.errors[code as keyof typeof text.errors] ?? text.errors.unknown);
  const focusScan = () => requestAnimationFrame(() => scanInput.current?.focus());

  function call<T>(action: () => Promise<DeskResult<T>>, onData: (data: T) => void) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) onData(result.data);
      else refuse(result.error);
      focusScan();
    });
  }

  function resetCheckout() {
    setMember(null);
    setMatches(null);
    setScanned([]);
    setOverride(false);
    setDone(null);
    setError(null);
    setNotice(null);
    focusScan();
  }

  function resetReturn() {
    setCopy(null);
    setReturned(null);
    setCondition("same");
    setError(null);
    focusScan();
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
    focusScan();
  }

  // A new panel (mode, member, finished checkout) puts the cursor back in its scan field.
  useEffect(() => {
    scanInput.current?.focus();
  }, [mode, member, done]);

  // F2 / F3 / Esc work anywhere on the desk screen.
  function escape() {
    if (mode === "return") {
      if (copy || returned) resetReturn();
    } else if (done || member || matches) resetCheckout();
  }

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "F2") switchMode("checkout");
    else if (event.key === "F3") switchMode("return");
    else if (event.key === "Escape") escape();
    else return;
    event.preventDefault();
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  // ─── Check out actions ─────────────────────────────────────────────────────

  function find(q: string) {
    if (q.trim().length < 2) return;
    call(
      () => findMembers(q.trim()),
      (found) => {
        if (found.length === 0) setError(format(d.noMatch, { q: q.trim() }));
        else if (found.length === 1) choose(found[0].id);
        else setMatches(found);
      },
    );
  }

  function choose(memberId: string) {
    call(
      () => loadMember(memberId),
      (loaded) => {
        setMember(loaded);
        setMatches(null);
        setScanned([]);
        setDone(null);
      },
    );
  }

  function addCopy(barcode: string) {
    if (!member) return;
    const code = barcode.trim().toUpperCase();
    if (!code) return;
    if (scanned.some((s) => s.copy.barcode === code)) return setError(d.alreadyScanned);
    call(
      () => previewCopy(code, member.id),
      (found) => {
        if (found.checkoutRefusal && !(override && found.checkoutRefusal === "fines_over_limit")) return refuse(found.checkoutRefusal);
        setScanned((list) => [...list, { copy: found, at: new Date().toISOString() }]);
      },
    );
  }

  function confirmCheckout() {
    if (!member || scanned.length === 0) return;
    call(
      () => checkOut(member.id, scanned.map((s) => s.copy.barcode), override),
      (result) => setDone(result),
    );
  }

  function takePayment() {
    if (!member) return;
    const ids = member.unpaidFines.map((f) => f.id);
    const total = member.unpaidFines.reduce((sum, f) => sum + f.amount, 0);
    call(
      () => payFines(ids),
      () => {
        choose(member.id);
        setNotice(format(d.paid, { amount: formatMoney(total, locale) }));
      },
    );
  }

  // ─── Return actions ────────────────────────────────────────────────────────

  function scanReturn(barcode: string) {
    const code = barcode.trim().toUpperCase();
    if (!code) return;
    setReturned(null);
    setCondition("same");
    call(
      () => previewCopy(code),
      (found) => {
        if (!found.loan) {
          setCopy(null);
          return refuse("copy_not_on_loan");
        }
        setCopy(found);
      },
    );
  }

  function confirmReturn(collect: boolean) {
    if (!copy) return;
    const chosen = condition;
    call(
      async () => {
        const result = await checkIn(copy.barcode, chosen);
        if (!result.ok || !collect || !result.data.fine) return result;
        const paid = await payFines([result.data.fine.id]);
        return paid.ok ? result : { ok: false as const, error: paid.error };
      },
      (result) => {
        setReturned({ result, collected: collect && !!result.fine, condition: chosen });
        setCopy(null);
      },
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const tab = (value: Mode, label: string, key: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => switchMode(value)}
      className={`inline-flex h-13 items-center gap-3 px-6.5 text-[17px] ${mode === value ? "bg-ink text-paper" : "bg-transparent text-ink hover:bg-paper-2"}`}
    >
      {label}
      <kbd className="border border-current px-1.5 py-px font-sans text-[11px] opacity-60">{key}</kbd>
    </button>
  );

  const status = (
    <span className={`inline-flex items-center gap-2 text-sm ${scanFocused ? "text-available" : "text-ink-muted"}`} aria-live="polite">
      <span aria-hidden className="size-2 rounded-full bg-current" />
      {scanFocused ? d.scannerReady : d.scannerIdle}
    </span>
  );

  const scanEvents = { onFocus: () => setScanFocused(true), onBlur: () => setScanFocused(false) };

  return (
    <>
      <AdminTopBar staff={staff} languageLabel={text.languageLabel} status={status}>
        <div role="tablist" aria-label={d.modeLabel} className="inline-flex border border-ink">
          {tab("checkout", d.checkOut, "F2")}
          {tab("return", d.return, "F3")}
        </div>
      </AdminTopBar>
      <div className="flex flex-wrap items-start gap-7 px-3.5 pt-8 pb-12 sm:px-10">
        <main className="flex min-w-0 flex-[3_1_600px] flex-col gap-5.5">
          {mode === "checkout" ? (
            member ? (
              checkoutPanel()
            ) : (
              findMemberPanel()
            )
          ) : (
            returnPanel()
          )}
        </main>
        <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-4 print:hidden">{side}</aside>
      </div>
    </>
  );

  // Render helpers below are closures over the desk state, called as functions (not mounted as
  // components) so the scan field keeps its focus and value between renders.

  function messages() {
    return (
      <>
        {error && (
          <p role="alert" className="m-0 animate-swap border-l-2 border-overdue bg-overdue-bg px-4 py-3 text-[15px] text-overdue">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="m-0 animate-swap border-l-2 border-available bg-available-bg px-4 py-3 text-[15px] text-available">
            {notice}
          </p>
        )}
      </>
    );
  }

  function scanField({ id, label, placeholder, onScan, button }: { id: string; label: string; placeholder: string; onScan: (value: string) => void; button?: string }) {
    return (
      <form
        className="flex flex-col gap-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const form = event.currentTarget;
          onScan(String(new FormData(form).get("code") ?? ""));
          // Every scan starts from an empty field, or a refused barcode would prefix the next one.
          form.reset();
        }}
      >
        <label htmlFor={id} className="eyebrow text-[10px] text-ink-muted">
          {label}
        </label>
        <div className="flex flex-wrap gap-3">
          <div className={SCAN_BOX}>
            <ScanBarcode aria-hidden size={28} strokeWidth={1.5} className="flex-none text-plum-500" />
            <input
              ref={scanInput}
              id={id}
              name="code"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              autoFocus
              placeholder={placeholder}
              // Stays enabled while a scan is checked: disabling it would drop the focus a scanner types into.
              aria-busy={pending}
              className={SCAN_INPUT}
              {...scanEvents}
            />
            <span className="hidden text-[13px] text-ink-muted sm:inline">{d.enter}</span>
          </div>
          {button && (
            <button type="submit" disabled={pending} className="eyebrow h-19 border border-ink px-6.5 text-[11px] text-ink hover:bg-ink hover:text-paper disabled:opacity-50">
              {button}
            </button>
          )}
        </div>
      </form>
    );
  }

  function findMemberPanel() {
    return (
      <div className="flex animate-swap flex-col gap-5">
        {scanField({ id: "desk-member", label: d.findLabel, placeholder: "MB-4K7Q", onScan: find, button: d.find })}
        <span className="-mt-2 text-[13px] text-ink-muted">{d.findHint}</span>
        {messages()}
        {matches && (
          <section aria-label={d.pickMember} className="flex flex-col border border-line bg-paper-3">
            <p className="m-0 border-b border-line px-6 py-3.5 text-[15px] text-ink-muted">{d.pickMember}</p>
            {matches.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => choose(m.id)}
                className="flex items-center gap-4 border-b border-line px-6 py-3.5 text-left last:border-b-0 hover:bg-paper-2"
              >
                <Avatar name={m.fullName} size="small" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-base">{m.fullName}</span>
                  <span className="truncate text-[13px] text-ink-muted">{[m.cardNumber, m.studentNumber, m.email].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            ))}
          </section>
        )}
      </div>
    );
  }

  function checkoutPanel() {
    const m = member!;
    const reserved = m.readyReservations;
    const matchFor = (r: ReservationDto) => scanned.find((s) => s.copy.book.id === r.book.id);
    const reservedIds = new Set(reserved.map((r) => r.book.id));
    const walkIns = scanned.filter((s) => !reservedIds.has(s.copy.book.id));
    const reservedDone = reserved.filter((r) => matchFor(r)).length;
    const total = reserved.length + walkIns.length;
    const complete = total > 0 && scanned.length === total;
    const blocking = m.standing.blockedReason && BLOCKING.includes(m.standing.blockedReason) ? m.standing.blockedReason : null;
    const blocked = blocking && !(override && blocking === "fines_over_limit");
    const books = (count: number) => (count === 1 ? d.oneBook : format(d.booksN, { count: String(count) }));
    const dueAt = done?.dueAt ?? (mounted ? new Date(Date.now() + loanDays * 86_400_000).toISOString() : null);
    const byCode = new Map<string, ReservationDto[]>();
    for (const r of reserved) byCode.set(r.code, [...(byCode.get(r.code) ?? []), r]);

    if (blocked && blocking) return blockedView(blocking);

    return (
      <>
        <ol aria-label={d.stepsLabel} className="m-0 grid animate-swap list-none grid-cols-3 gap-2 p-0 print:hidden">
          <Step bar="bg-plum-700" label={`${d.stepMember} ✓`} />
          <Step bar={complete || done ? "bg-plum-700" : "bg-gold"} label={format(d.stepCopies, { count: `${scanned.length}/${Math.max(total, scanned.length)}${complete ? " ✓" : ""}` })} />
          <Step bar={done ? "bg-plum-700" : complete ? "bg-gold" : "bg-line"} label={d.stepConfirm} muted={!complete && !done} />
        </ol>

        {memberCard()}

        {done ? (
          doneView(done)
        ) : (
          <div className="flex flex-col gap-5.5 print:hidden">
            {override && <p className="m-0 border-l-4 border-gold bg-ready-bg px-4 py-3 text-[15px] text-ready">{d.overrideOn}</p>}
            {m.standing.blockedReason === "loan_limit_reached" && <p className="m-0 border-l-4 border-gold bg-ready-bg px-4 py-3 text-[15px] text-ready">{d.limitReached}</p>}

            {[...byCode].map(([code, rows]) => (
              <section key={code} aria-label={format(d.reservation, { code })} className="border border-line bg-paper-3">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
                  <h2 className="m-0 font-serif text-2xl font-normal">{format(d.reservation, { code })}</h2>
                  <span className="eyebrow bg-ready-bg px-2 py-1 text-[9.5px] text-ready">{d.readyBadge}</span>
                </div>
                {rows.map((r) => {
                  const match = matchFor(r);
                  return (
                    <div key={r.id} className={`flex items-center gap-4.5 border-b border-line px-6 py-4.5 last:border-b-0 ${match ? "" : "bg-ready-bg/30"}`}>
                      <BookCover book={r.book} sizes="40px" className="w-10" />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="font-serif text-[21px] leading-tight">{r.book.title}</span>
                        <span className="text-[13px] text-ink-muted">{format(d.copyLine, { barcode: r.copyBarcode ?? "—", shelf: r.shelfLocation ?? "—" })}</span>
                      </span>
                      {match ? (
                        <span className="flex flex-col items-end gap-0.5 text-right">
                          <span className="inline-flex items-center gap-2 text-sm text-available">
                            <Check aria-hidden size={18} strokeWidth={1.75} />
                            {format(d.scannedAt, { time: formatTime(match.at, locale) })}
                          </span>
                          {match.copy.barcode !== r.copyBarcode && <span className="text-xs text-ink-muted">{format(d.otherCopy, { barcode: match.copy.barcode })}</span>}
                        </span>
                      ) : (
                        <span className="eyebrow border border-dashed border-gold px-2.25 py-1.25 text-[9.5px] whitespace-nowrap text-ready">{d.waitingScan}</span>
                      )}
                    </div>
                  );
                })}
              </section>
            ))}

            {walkIns.length > 0 && (
              <section aria-label={d.walkIn} className="border border-line bg-paper-3">
                <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-6 py-4">
                  <h2 className="m-0 font-serif text-2xl font-normal">{d.walkIn}</h2>
                  <span className="text-[13px] text-ink-muted">{d.walkInNote}</span>
                </div>
                {walkIns.map((s) => (
                  <div key={s.copy.barcode} className="flex items-center gap-4.5 border-b border-line px-6 py-4.5 last:border-b-0">
                    <BookCover book={s.copy.book} sizes="40px" className="w-10" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-serif text-[21px] leading-tight">{s.copy.book.title}</span>
                      <span className="text-[13px] text-ink-muted">{format(d.copyLine, { barcode: s.copy.barcode, shelf: s.copy.shelfLocation ?? "—" })}</span>
                    </span>
                    <span className="inline-flex items-center gap-2 text-sm text-available">
                      <Check aria-hidden size={18} strokeWidth={1.75} />
                      {format(d.scannedAt, { time: formatTime(s.at, locale) })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setScanned((list) => list.filter((x) => x !== s))}
                      aria-label={`${d.remove}: ${s.copy.book.title}`}
                      className="inline-flex size-9 items-center justify-center text-ink-muted hover:text-overdue"
                    >
                      <X aria-hidden size={18} strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
              </section>
            )}

            <div className="flex flex-col gap-2.5">
              {scanField({ id: "desk-copy", label: d.scanLabel, placeholder: "BK0000001", onScan: addCopy, button: d.addCopy })}
              <span className="text-[13px] text-ink-muted">{d.scanNote}</span>
            </div>
            {messages()}
            {reserved.length > 0 && reservedDone === reserved.length && (
              <p role="status" className="m-0 flex items-center gap-3 bg-available-bg px-4.5 py-3.5 text-[15px] text-available">
                <CircleCheck aria-hidden size={20} strokeWidth={1.5} />
                {d.allMatch}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
              <span className="flex flex-col gap-0.5">
                <span className="eyebrow text-[10px] text-ink-muted">{d.dueBack}</span>
                <span className="font-serif text-[28px]">{dueAt ? formatDay(dueAt, locale) : " "}</span>
              </span>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={resetCheckout} className="eyebrow h-15 px-5 text-[11px] text-ink hover:bg-paper-2">
                  {d.cancel} <span className="opacity-60">· Esc</span>
                </button>
                <button
                  type="button"
                  onClick={confirmCheckout}
                  disabled={scanned.length === 0 || pending}
                  className="eyebrow h-15 bg-plum-700 px-8 text-xs text-paper hover:bg-plum-900 disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-muted"
                >
                  {format(d.confirmCheckout, { books: books(scanned.length) })}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );

    function doneView(result: CheckoutManyResultDto) {
      return (
        <>
          <section role="status" className="flex animate-swap flex-col items-start gap-4 bg-plum-700 p-6 text-cream sm:p-10 print:hidden">
            <span className="inline-flex size-14 items-center justify-center rounded-full border border-cream">
              <Check aria-hidden size={26} strokeWidth={1.5} />
            </span>
            <span className="font-serif text-[36px] leading-none sm:text-[44px]">{format(d.done, { books: books(result.loans.length) })}</span>
            <span className="text-[17px] text-mauve-2">{format(d.doneLine, { name: m.fullName, date: formatDay(result.dueAt, locale) })}</span>
            <div className="mt-2 flex flex-wrap gap-3">
              <button type="button" autoFocus onClick={resetCheckout} className="eyebrow h-13 bg-[#f3ece2] px-6 text-[11px] text-ink hover:bg-paper">
                {d.nextMember} <span className="opacity-60">· Esc</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="eyebrow inline-flex h-13 items-center gap-2 border border-cream/50 px-5.5 text-[11px] text-cream hover:bg-cream/10"
              >
                <Printer aria-hidden size={16} strokeWidth={1.5} />
                {d.printSlip}
              </button>
            </div>
          </section>
          <Slip title={d.slipTitle} lines={[m.fullName, m.cardNumber, `${d.dueBack}: ${formatDay(result.dueAt, locale)}`]} items={result.loans.map((l) => `${l.book.title} · ${l.copyBarcode}`)} />
        </>
      );
    }

    function memberCard() {
      const overdue = m.activeLoans.filter((l) => l.daysOverdue > 0).length;
      const fines = m.standing.unpaidFines;
      const over = m.standing.fineBlockThreshold > 0 && fines >= m.standing.fineBlockThreshold;
      const subtitle = [text.memberTypes[m.memberType], m.faculty, m.studentNumber ?? m.cardNumber].filter(Boolean).join(" · ");
      return (
        <section aria-label={d.memberLabel} className="flex animate-swap flex-wrap items-center gap-x-6 gap-y-4.5 border border-line bg-paper-3 p-6">
          <Avatar name={m.fullName} dark={!!blocking} />
          <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
            <span className="font-serif text-[30px] leading-[1.05]">{m.fullName}</span>
            <span className="text-sm text-ink-muted">{subtitle}</span>
          </div>
          {blocked ? (
            <span className="eyebrow bg-overdue px-2.5 py-1.5 text-[10px] text-[#fbf3ef]">{d.blocked}</span>
          ) : (
            <div className="flex flex-wrap gap-2 text-[13px]">
              <span className="bg-paper-2 px-2.5 py-1.25">{format(d.loansChip, { count: String(m.standing.activeLoans), max: String(m.standing.maxActiveLoans) })}</span>
              {overdue > 0 && <span className="bg-overdue-bg px-2.5 py-1.25 text-overdue">{format(d.overdueChip, { count: String(overdue) })}</span>}
              {fines > 0 && (
                <span className={`px-2.5 py-1.25 ${over ? "bg-overdue-bg text-overdue" : "bg-ready-bg text-ready"}`}>
                  {format(over ? d.fineOver : d.fineUnder, { amount: formatMoney(fines, locale) })}
                </span>
              )}
            </div>
          )}
          <button type="button" onClick={resetCheckout} className="eyebrow text-[10px] text-ink hover:text-plum-500 print:hidden">
            {d.changeMember} →
          </button>
        </section>
      );
    }

    function blockedView(reason: string) {
      const late = m.activeLoans.filter((l) => l.daysOverdue > 0).sort((a, b) => b.daysOverdue - a.daysOverdue)[0];
      const fines = m.unpaidFines.reduce((sum, f) => sum + f.amount, 0);
      const [title, detail] =
        reason === "fines_over_limit"
          ? [d.blockedFines, format(d.blockedFinesDetail, { amount: formatMoney(fines, locale), limit: formatMoney(m.standing.fineBlockThreshold, locale) })]
          : reason === "loan_overdue" && late
            ? [d.blockedOverdue, format(d.blockedOverdueDetail, { title: late.book.title, days: String(late.daysOverdue) })]
            : [d.blockedAccount, d.blockedAccountDetail];
      return (
        <>
          {memberCard()}
          <div role="alert" className="flex animate-swap flex-col gap-3.5 bg-overdue-bg p-7 text-overdue">
            <span className="font-serif text-[28px] leading-[1.1] sm:text-[32px]">{title}</span>
            <span className="text-base leading-[1.55] text-[#6e2a1e]">{detail}</span>
            <div className="mt-1 flex flex-wrap gap-3">
              {reason === "fines_over_limit" && fines > 0 && (
                <button type="button" onClick={takePayment} disabled={pending} className="eyebrow h-13 bg-plum-700 px-6 text-[11px] text-paper hover:bg-plum-900 disabled:opacity-60">
                  {format(d.takePayment, { amount: formatMoney(fines, locale) })}
                </button>
              )}
              {reason === "loan_overdue" && (
                <button
                  type="button"
                  onClick={() => switchMode("return")}
                  className="eyebrow h-13 border border-overdue px-5.5 text-[11px] text-overdue hover:bg-overdue hover:text-overdue-bg"
                >
                  {d.returnFirst}
                </button>
              )}
              {reason === "fines_over_limit" && canOverride && (
                <button type="button" onClick={() => setOverride(true)} className="eyebrow h-13 px-4 text-[11px] text-overdue underline underline-offset-5">
                  {d.override}
                </button>
              )}
            </div>
          </div>
          {messages()}
        </>
      );
    }
  }

  function returnPanel() {
    const loan = copy?.loan ?? null;
    const holdNext = copy?.nextReader && condition !== "damaged" ? copy.nextReader : null;
    return (
      <>
        <div className="flex animate-swap flex-col gap-2.5 print:hidden">
          {scanField({ id: "desk-return", label: d.scanReturn, placeholder: "BK0000001", onScan: scanReturn })}
          {copy && <span className="text-[13px] text-available">{d.found}</span>}
        </div>
        {messages()}

        {returned && returnedNote(returned)}

        {copy && loan && (
          <>
            {holdNext && (
              <div role="alert" className="flex animate-swap items-start gap-4.5 border-l-4 border-gold bg-ready-bg p-6 text-ready">
                <Package aria-hidden size={26} strokeWidth={1.5} className="flex-none" />
                <div className="flex flex-col gap-1.5">
                  <span className="font-serif text-[28px] leading-[1.1] text-[#5e3f10]">{d.holdTitle}</span>
                  <span className="text-[15px] leading-[1.55]">{format(d.holdDetail, { name: holdNext.memberName, code: holdNext.reservationCode })}</span>
                </div>
              </div>
            )}
            {condition === "damaged" && (
              <div role="alert" className="flex animate-swap items-start gap-4.5 border-l-4 border-stone bg-stone-bg p-6 text-stone">
                <Wrench aria-hidden size={26} strokeWidth={1.5} className="flex-none" />
                <div className="flex flex-col gap-1.5">
                  <span className="font-serif text-[28px] leading-[1.1] text-ink">{d.repairTitle}</span>
                  <span className="text-[15px] leading-[1.55]">{d.repairDetail}</span>
                </div>
              </div>
            )}

            <section aria-label={d.loanLabel} className="flex animate-swap flex-wrap gap-x-8 gap-y-6 border border-line bg-paper-3 p-6.5">
              <BookCover book={copy.book} sizes="72px" className="w-18" />
              <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
                <span className="font-serif text-[30px] leading-[1.05]">{copy.book.title}</span>
                <span className="text-sm text-ink-muted">{format(d.copyLine, { barcode: copy.barcode, shelf: copy.shelfLocation ?? "—" })}</span>
                <span className="mt-2 text-[15px]">
                  {format(d.borrowedBy, { name: "\u0000", date: formatDay(loan.checkedOutAt, locale) })
                    .split("\u0000")
                    .flatMap((part, i) =>
                      i === 0
                        ? [part]
                        : [
                            <Link key="m" href={`/${locale}/admin/desk?member=${loan.memberId}`} className="text-ink underline underline-offset-4 hover:text-plum-500">
                              {loan.memberName}
                            </Link>,
                            part,
                          ],
                    )}
                </span>
              </div>
              <dl className="m-0 grid flex-[1_1_260px] grid-cols-3 gap-3 self-center">
                <Stat label={d.due} value={formatDay(loan.dueAt, locale)} />
                <Stat label={d.late} value={loan.daysOverdue ? format(d.lateDays, { count: String(loan.daysOverdue) }) : d.onTime} tone={loan.daysOverdue ? "late" : "ok"} />
                <Stat label={d.fine} value={formatMoney(loan.fine, locale)} tone={loan.fine ? "late" : "ok"} />
              </dl>
            </section>

            <div className="flex animate-swap flex-wrap items-end justify-between gap-4 border-t border-line pt-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="desk-condition" className="eyebrow text-[10px] text-ink-muted">
                  {d.condition}
                </label>
                <select
                  id="desk-condition"
                  value={condition}
                  onChange={(event) => setCondition(event.target.value as ReturnCondition)}
                  className="h-13 min-w-55 rounded-xs border border-line bg-paper-3 px-3.5 text-base text-ink"
                >
                  {(["same", "worn", "damaged"] as const).map((c) => (
                    <option key={c} value={c}>
                      {d.conditions[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-3">
                {loan.fine > 0 && (
                  <button
                    type="button"
                    onClick={() => confirmReturn(true)}
                    disabled={pending}
                    className="eyebrow h-15 border border-ink px-5 text-[11px] text-ink hover:bg-ink hover:text-paper disabled:opacity-50"
                  >
                    {format(d.collect, { amount: formatMoney(loan.fine, locale) })}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => confirmReturn(false)}
                  disabled={pending}
                  className="eyebrow h-15 bg-plum-700 px-8 text-xs text-paper hover:bg-plum-900 disabled:opacity-60"
                >
                  {holdNext ? d.confirmReturnHold : d.confirmReturn}
                </button>
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  function returnedNote(value: Returned) {
    const { result, collected } = value;
    const hold = result.holdFor;
    const lines = [
      result.fine ? format(collected ? d.returnedPaid : d.returnedFine, { amount: formatMoney(result.fine.amount, locale) }) : null,
      hold ? format(d.returnedHold, { name: hold.memberName, code: hold.reservationCode }) : value.condition === "damaged" ? d.returnedRepair : d.returnedShelf,
    ].filter((line): line is string => !!line);
    return (
      <>
        <section role="status" className="flex animate-swap flex-col gap-2 border-l-4 border-available bg-available-bg px-6 py-5 text-available print:hidden">
          <span className="font-serif text-[26px] leading-tight">{format(d.returned, { title: result.loan.book.title })}</span>
          {lines.map((line) => (
            <span key={line} className="text-[15px]">
              {line}
            </span>
          ))}
          {hold && (
            <button
              type="button"
              onClick={() => window.print()}
              className="eyebrow mt-2 inline-flex h-11 items-center gap-2 self-start border border-available px-4 text-[11px] text-available hover:bg-available hover:text-available-bg"
            >
              <Printer aria-hidden size={16} strokeWidth={1.5} />
              {d.holdSlipTitle}
            </button>
          )}
        </section>
        {hold && (
          <Slip
            title={d.holdSlipTitle}
            lines={[hold.memberName, hold.reservationCode, formatDay(hold.expiresAt, locale) + " " + formatTime(hold.expiresAt, locale)]}
            items={[`${result.loan.book.title} · ${result.loan.copyBarcode}`]}
          />
        )}
      </>
    );
  }
}

function Step({ bar, label, muted }: { bar: string; label: string; muted?: boolean }) {
  return (
    <li className="flex flex-col gap-2">
      <span className={`h-0.75 ${bar}`} />
      <span className={`eyebrow text-[10px] ${muted ? "text-ink-muted" : ""}`}>{label}</span>
    </li>
  );
}

function Avatar({ name, dark, size }: { name: string; dark?: boolean; size?: "small" }) {
  return (
    <span
      aria-hidden
      className={`inline-flex flex-none items-center justify-center rounded-full font-serif text-paper ${dark ? "bg-ink" : "bg-plum-700"} ${
        size === "small" ? "size-10 text-base" : "size-16 text-[26px]"
      }`}
    >
      {initials(name)}
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "late" | "ok" }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="eyebrow text-[9.5px] text-ink-muted">{label}</dt>
      <dd className={`m-0 text-lg ${tone === "late" ? "text-overdue" : tone === "ok" ? "text-available" : ""}`}>{value}</dd>
    </div>
  );
}

/** What the slip printer gets: only this block is printed (everything else is print:hidden). */
function Slip({ title, lines, items }: { title: string; lines: string[]; items: string[] }) {
  return (
    <div className="hidden flex-col gap-2 font-sans text-sm text-black print:flex">
      <span className="font-serif text-lg tracking-[.24em]">MY / BOOK</span>
      <strong className="text-base">{title}</strong>
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
      <ul className="m-0 mt-2 list-none border-t border-black p-0 pt-2">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
