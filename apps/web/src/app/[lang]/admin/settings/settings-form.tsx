"use client";

import { useState, useTransition } from "react";
import type { IntegrationDto, IntegrationTestDto, LibrarySettingsDto } from "@mybook/shared";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import { saveSettings, testIntegration } from "./actions";

type Text = Dictionary["admin"]["settings"];
type Key = keyof LibrarySettingsDto;

const KEYS: Key[] = ["loanDays", "maxActiveLoans", "maxRenewals", "pickupWindowHours", "finePerDay", "fineBlockThreshold"];
const SECTION = "flex scroll-mt-6 flex-col gap-4";
const H2 = "m-0 font-serif text-[32px] font-normal";

/** Lira amounts are typed the local way ("2,50" in Turkish, "2.50" in English). */
const parseMoney = (value: string) => {
  const n = Number(value.trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

/** B20 form: steppers and amounts with a sticky "unsaved changes" bar, plus live tests of the book sources. */
export function SettingsForm({
  settings,
  integrations,
  editable,
  locale,
  text: s,
}: {
  settings: LibrarySettingsDto;
  integrations: IntegrationDto[];
  editable: boolean;
  locale: Locale;
  text: Text;
}) {
  const [saved, setSaved] = useState(settings);
  const [values, setValues] = useState(settings);
  const [money, setMoney] = useState({ finePerDay: fmt(settings.finePerDay), fineBlockThreshold: fmt(settings.fineBlockThreshold) });
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [tests, setTests] = useState<Record<string, IntegrationTestDto | "pending">>({});
  const [pending, startTransition] = useTransition();

  function fmt(n: number) {
    return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(n);
  }

  const changed = KEYS.filter((k) => values[k] !== saved[k]);
  const set = (k: Key, v: number) => {
    setMessage(null);
    setValues((cur) => ({ ...cur, [k]: v }));
  };

  function save() {
    const input = Object.fromEntries(changed.map((k) => [k, values[k]]));
    startTransition(async () => {
      const result = await saveSettings(input);
      if (result.ok) {
        setSaved(result.data);
        setValues(result.data);
        setMessage({ tone: "ok", text: s.saved });
      } else setMessage({ tone: "error", text: s.error });
    });
  }

  function discard() {
    setValues(saved);
    setMoney({ finePerDay: fmt(saved.finePerDay), fineBlockThreshold: fmt(saved.fineBlockThreshold) });
    setMessage(null);
  }

  function test(id: IntegrationDto["id"]) {
    setTests((t) => ({ ...t, [id]: "pending" }));
    startTransition(async () => {
      const result = await testIntegration(id);
      setTests((t) => ({ ...t, [id]: result.ok ? result.data : { id, ok: false, ms: 0, count: null, error: "—" } }));
    });
  }

  const stepper = (k: Key, label: string, hint: string, unit: string, step: number, min: number, max: number) => (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line px-5.5 py-4.5 last:border-b-0">
      <span className="flex max-w-120 flex-col gap-0.5">
        <span className="text-base">{label}</span>
        <span className="text-[13px] text-ink-muted">{hint}</span>
      </span>
      <span className="flex items-center gap-3">
        <span className="inline-flex items-center border border-line bg-paper">
          <button
            type="button"
            disabled={!editable || values[k] <= min}
            aria-label={format(s.decrease, { label: label.toLocaleLowerCase(locale) })}
            onClick={() => set(k, Math.max(min, values[k] - step))}
            className="size-10 text-lg text-ink disabled:text-ink-muted/50"
          >
            −
          </button>
          <span aria-live="polite" className={`w-13 text-center font-serif text-[22px] tabular-nums ${values[k] !== saved[k] ? "text-plum-500" : ""}`}>
            {values[k]}
          </span>
          <button
            type="button"
            disabled={!editable || values[k] >= max}
            aria-label={format(s.increase, { label: label.toLocaleLowerCase(locale) })}
            onClick={() => set(k, Math.min(max, values[k] + step))}
            className="size-10 text-lg text-ink disabled:text-ink-muted/50"
          >
            +
          </button>
        </span>
        <span className="w-24 text-[13px] text-ink-muted">{unit}</span>
      </span>
    </div>
  );

  const moneyField = (k: "finePerDay" | "fineBlockThreshold", label: string, hint: string) => (
    <label className="flex flex-col gap-3 border border-line bg-paper-3 p-5.5">
      <span className="eyebrow text-[10px]">{label}</span>
      <span className={`flex h-12 items-center gap-2 border bg-paper px-3.5 ${values[k] !== saved[k] ? "border-plum-500" : "border-line"}`}>
        <span className="font-serif text-xl text-ink-muted">₺</span>
        <input
          inputMode="decimal"
          disabled={!editable}
          value={money[k]}
          onChange={(e) => {
            setMoney((m) => ({ ...m, [k]: e.target.value }));
            const n = parseMoney(e.target.value);
            if (n !== null) set(k, n);
          }}
          onBlur={() => setMoney((m) => ({ ...m, [k]: fmt(values[k]) }))}
          className="min-w-0 flex-1 border-0 bg-transparent font-serif text-[22px] tabular-nums outline-none disabled:text-ink-muted"
        />
      </span>
      <span className="text-[13px] text-ink-muted">{hint}</span>
    </label>
  );

  return (
    <>
      <nav aria-label={s.sectionsLabel} className="sticky top-0 z-10 flex gap-6 overflow-x-auto border-b border-line bg-paper px-3.5 [scrollbar-width:none] sm:px-10 print:hidden">
        {(Object.keys(s.sections) as (keyof Text["sections"])[]).map((key) => (
          <a key={key} href={`#${key}`} className="border-b-2 border-transparent py-3.5 text-[15px] whitespace-nowrap text-ink-muted no-underline hover:border-line hover:text-ink">
            {s.sections[key]}
          </a>
        ))}
      </nav>
      <main className="flex flex-col gap-12 px-3.5 pt-8 pb-32 sm:px-10">
        {!editable && <p className="m-0 border-l-2 border-gold bg-ready-bg px-4 py-3 text-sm text-ready">{s.readOnly}</p>}

        <section id="loans" aria-labelledby="h-loans" className={SECTION}>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="h-loans" className={H2}>
              {s.loansTitle}
            </h2>
            <span className="text-sm text-ink-muted">{s.loansNote}</span>
          </div>
          <div className="border border-line bg-paper-3">
            {stepper("loanDays", s.loanDays, s.loanDaysHint, s.units.days, 7, 7, 42)}
            {stepper("maxActiveLoans", s.maxActiveLoans, s.maxActiveLoansHint, s.units.books, 1, 1, 15)}
            {stepper("maxRenewals", s.maxRenewals, s.maxRenewalsHint, s.units.perLoan, 1, 0, 3)}
          </div>
        </section>

        <section id="fines" aria-labelledby="h-fines" className={SECTION}>
          <h2 id="h-fines" className={H2}>
            {s.finesTitle}
          </h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {moneyField("finePerDay", s.finePerDay, s.finePerDayHint)}
            {moneyField("fineBlockThreshold", s.fineBlockThreshold, s.fineBlockThresholdHint)}
          </div>
        </section>

        <section id="holds" aria-labelledby="h-holds" className={SECTION}>
          <h2 id="h-holds" className={H2}>
            {s.holdsTitle}
          </h2>
          <div className="border border-line bg-paper-3">
            {stepper("pickupWindowHours", s.pickupWindowHours, s.pickupWindowHoursHint, s.units.hours, 24, 24, 168)}
            <div className="flex items-center justify-between gap-6 px-5.5 py-4.5">
              <span className="text-base">{s.codeFormat}</span>
              <span className="font-serif text-[22px] tracking-[.08em]">MB-4K7Q</span>
            </div>
          </div>
        </section>

        <section id="api" aria-labelledby="h-api" className={SECTION}>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="h-api" className={H2}>
              {s.apiTitle}
            </h2>
            <span className="text-sm text-ink-muted">{s.apiNote}</span>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {integrations.map((i) => {
              const result = tests[i.id];
              return (
                <div key={i.id} className={`flex flex-col gap-3 border bg-paper-3 p-5 ${i.configured ? "border-line" : "border-gold"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex flex-col gap-1">
                      <span className="eyebrow text-[9px] text-ink-muted">{s.kinds[i.kind]}</span>
                      <span lang="en" className="font-serif text-[22px] leading-tight">
                        {s.names[i.id]}
                      </span>
                    </span>
                    <span className={`eyebrow rounded-xs px-2 py-1 text-[9px] whitespace-nowrap ${i.configured ? "bg-available-bg text-available" : "bg-ready-bg text-ready"}`}>
                      {i.configured ? s.configured : s.notConfigured}
                    </span>
                  </div>
                  <span className="flex-1 text-[13px] text-ink-muted">{s.details[i.id]}</span>
                  <div className="flex flex-col items-start gap-2">
                    <button
                      type="button"
                      disabled={result === "pending"}
                      onClick={() => test(i.id)}
                      className="eyebrow h-9 border border-ink px-3.5 text-[9px] text-ink hover:bg-ink hover:text-paper disabled:opacity-60"
                    >
                      {result === "pending" ? s.testing : result ? s.testAgain : s.test}
                    </button>
                    {result && result !== "pending" && (
                      <span role="status" className={`text-xs ${result.ok ? "text-available" : "text-ready"}`}>
                        {result.ok
                          ? format(i.id === "SUPABASE" ? s.testOkDb : s.testOk, { ms: String(result.ms), count: String(result.count ?? 0) })
                          : format(result.count === 0 ? s.testEmpty : s.testFail, { ms: String(result.ms), detail: result.error ?? "" })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {(changed.length > 0 || message) && (
        <div role="region" aria-label={s.save} className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-line bg-plum-900 px-3.5 py-3.5 text-paper sm:px-10 print:hidden">
          <span className="flex-1 text-[15px]" role={message ? "status" : undefined}>
            {message ? message.text : changed.length === 1 ? s.oneUnsaved : format(s.unsaved, { count: String(changed.length) })}
          </span>
          {changed.length > 0 && (
            <>
              <button type="button" onClick={discard} className="eyebrow h-10 border border-paper/40 px-4 text-[10px] text-paper hover:bg-paper/10">
                {s.discard}
              </button>
              <button type="button" disabled={pending || !editable} onClick={save} className="eyebrow h-10 bg-paper px-5 text-[10px] text-ink hover:bg-paper-2 disabled:opacity-60">
                {pending ? s.saving : s.save}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
