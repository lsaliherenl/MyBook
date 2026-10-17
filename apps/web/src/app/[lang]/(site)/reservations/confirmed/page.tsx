import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, Check } from "lucide-react";
import type { ProfileDto, ReservationDto } from "@mybook/shared";
import { ActionButton } from "@/components/action-button";
import { BookCover } from "@/components/book-cover";
import { AddToCalendarButton, PassActions } from "@/components/reservation/pass-actions";
import type { Locale } from "@/i18n/config";
import { format, getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { api } from "@/lib/api";
import { getRules } from "@/lib/catalog";
import { formatDay, formatTime } from "@/lib/format";
import { qrSvg } from "@/lib/qr";
import { cancelReservation } from "../../circulation-actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.reservation.title, robots: { index: false } };
}

export default async function ReservationConfirmedPage({ searchParams }: PageProps<"/[lang]/reservations/confirmed">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Confirmation searchParams={searchParams} t={t} locale={locale} />
    </Suspense>
  );
}

type StepState = "done" | "current" | "todo";

async function Confirmation({
  searchParams,
  t,
  locale,
}: {
  searchParams: PageProps<"/[lang]/reservations/confirmed">["searchParams"];
  t: Dictionary;
  locale: Locale;
}) {
  const raw = (await searchParams).ids;
  const ids = (Array.isArray(raw) ? raw[0] : (raw ?? "")).split(",").filter(Boolean);
  const [all, profile, rules] = await Promise.all([
    api<ReservationDto[]>("/me/reservations", { auth: true }).catch(() => []),
    api<ProfileDto>("/me", { auth: true }).catch(() => null),
    getRules(),
  ]);
  const reservations = all.filter((r) => ids.includes(r.id));
  if (!reservations.length || !profile) redirect(`/${locale}/account/loans`);

  const r = t.reservation;
  const open = reservations.filter((x) => x.status === "PENDING" || x.status === "READY");
  const ready = open.filter((x) => x.status === "READY");
  const queued = open.filter((x) => x.status === "PENDING");
  const code = reservations[0].code;
  const one = reservations.length === 1;
  const allReady = open.length > 0 && queued.length === 0;
  const deadline = ready.map((x) => x.expiresAt!).sort()[0] ?? null;
  const createdAt = reservations[0].createdAt;
  const nextInLine = Math.min(...queued.map((x) => x.queuePosition ?? 1));
  const bookCount = format(one ? t.bag.countOne : t.bag.count, { count: String(reservations.length) });

  const headline = allReady
    ? one
      ? r.headlineReadyOne
      : r.headlineReady
    : ready.length === 0
      ? r.headlineQueued
      : one
        ? r.headlineReservedOne
        : r.headlineReserved;
  const lede = allReady ? r.ledeReady : ready.length ? r.ledeMixed : format(r.ledeQueued, { hours: String(rules.pickupWindowHours) });
  const when = (iso: string) => `${formatDay(iso, locale)} · ${formatTime(iso, locale)}`;

  const steps: { label: string; note: string; state: StepState }[] = [
    { label: r.steps.reserved, note: when(createdAt), state: "done" },
    allReady || ready.length
      ? { label: r.steps.setAside, note: ready[0].readyAt ? when(ready[0].readyAt) : "", state: "done" }
      : { label: r.steps.queued, note: nextInLine > 1 ? format(r.stepNotes.queued, { count: String(nextInLine - 1) }) : r.stepNotes.queuedNext, state: "current" },
    {
      label: r.steps.ready,
      note: deadline ? format(r.stepNotes.collectBy, { date: formatDay(deadline, locale), time: formatTime(deadline, locale) }) : r.stepNotes.willEmail,
      state: ready.length ? "current" : "todo",
    },
    { label: r.steps.collected, note: r.stepNotes.atDesk, state: "todo" },
  ];
  const sundayInWindow = deadline !== null && new Date(deadline).getTime() - new Date(ready[0].readyAt ?? createdAt).getTime() > rules.pickupWindowHours * 3_600_000;
  const passSvg = await qrSvg(`MYBOOK:RES:${code}`);

  return (
    <>
      <div className="container-page flex flex-wrap items-start gap-12 pt-12 pb-20 sm:pt-18 sm:pb-24 lg:gap-18">
        <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-7">
          <div className="flex items-center gap-4">
            <span className="inline-flex size-13 flex-none items-center justify-center rounded-full border border-plum-700 text-plum-700">
              <Check aria-hidden size={24} strokeWidth={1.5} />
            </span>
            <span className="eyebrow text-ink-muted">{format(r.reference, { code, date: when(createdAt) })}</span>
          </div>
          <h1 className="m-0 font-serif text-[48px] leading-[.95] font-light sm:text-[clamp(56px,6vw,88px)]">{headline}</h1>
          <p className="m-0 max-w-140 text-lg leading-[1.65] font-light">{lede}</p>

          <ol aria-label={r.progress} className="m-0 mt-4 grid list-none grid-cols-2 gap-y-6 p-0 sm:grid-cols-4">
            {steps.map((s) => (
              <li
                key={s.label}
                aria-current={s.state === "current" ? "step" : undefined}
                className={`mr-1.5 flex flex-col gap-2.5 border-t-3 pt-4 ${s.state === "done" ? "border-plum-700" : s.state === "current" ? "border-gold" : "border-line"}`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`inline-flex size-4.5 items-center justify-center rounded-full border text-[10px] ${
                      s.state === "done" ? "border-plum-700 bg-plum-700 text-paper" : s.state === "current" ? "border-gold text-ready" : "border-line"
                    }`}
                  >
                    {s.state === "done" && <Check aria-hidden size={10} strokeWidth={2.5} />}
                  </span>
                  <span className={`eyebrow text-[10px] ${s.state === "todo" ? "text-ink-muted" : "text-ink"}`}>{s.label}</span>
                </span>
                <span className="text-[13px] text-ink-muted">{s.note}</span>
              </li>
            ))}
          </ol>

          <div className="mt-2 grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-3">
            <Fact label={deadline ? r.collectBy : r.readyWhen} value={deadline ? when(deadline) : r.readyWhenValue}>
              {deadline ? (
                sundayInWindow && <span className="text-ready">{r.sundayNote}</span>
              ) : (
                format(r.windowNote, { hours: String(rules.pickupWindowHours) })
              )}
            </Fact>
            <Fact label={r.where} value={r.desk}>
              {r.deskPlace}
            </Fact>
            <Fact label={r.loanPeriod} value={format(r.loanDays, { days: String(rules.loanDays) })}>
              {r.loanStarts}
            </Fact>
          </div>

          <div className="mt-2 flex flex-col">
            <span className="eyebrow mb-2 text-ink-muted">{format(r.inThis, { count: bookCount })}</span>
            {reservations.map((x, i) => (
              <div key={x.id} className={`flex items-center gap-4.5 border-b border-line py-4.5 ${i === 0 ? "border-t" : ""}`}>
                <Link href={`/${locale}/books/${x.book.slug}`} className="flex-none">
                  <BookCover book={x.book} sizes="48px" className="w-12" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-0.75">
                  <span lang={x.book.language} className="font-serif text-[22px] leading-[1.1]">
                    {x.book.title}
                  </span>
                  <span className="text-sm text-ink-muted">
                    {[x.book.authors.map((a) => a.name).join(", "), x.shelfLocation && format(r.copyShelf, { shelf: x.shelfLocation })].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <span className={`eyebrow text-right text-[10px] ${x.status === "READY" ? "text-ready" : "text-ink-muted"}`}>
                  {x.status === "READY" ? r.heldForYou : x.status === "PENDING" ? format(r.inQueue, { n: String(x.queuePosition ?? 1) }) : t.account.reservationStatus[x.status]}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              href={`/${locale}/account/loans`}
              className="eyebrow group inline-flex h-13 items-center gap-3 bg-plum-700 px-6 text-xs text-paper no-underline hover:bg-plum-900"
            >
              {r.myReservations}
              <ArrowRight aria-hidden size={16} strokeWidth={1.5} className="transition-transform group-hover:translate-x-1" />
            </Link>
            {deadline && (
              <AddToCalendarButton
                label={r.addToCalendar}
                title={format(r.calendarTitle, { code })}
                start={ready[0].readyAt ?? createdAt}
                end={deadline}
                location={`${r.desk}, ${r.deskPlace}`}
                code={code}
              />
            )}
            {open.length > 0 && (
              <ActionButton
                action={cancelReservation}
                fields={{ reservationIds: open.map((x) => x.id).join(",") }}
                label={r.cancel}
                errors={t.circulationErrors}
                success={r.cancelled}
                className="eyebrow h-13 px-2 text-[11px] text-overdue underline underline-offset-5 hover:text-plum-900"
              />
            )}
          </div>
        </div>

        <aside aria-label={r.pass} className="print-pass flex w-full min-w-75 flex-col bg-plum-700 text-cream shadow-[0_30px_60px_-24px_rgba(46,20,36,.6)] sm:flex-[0_1_420px]">
          <div className="flex items-center justify-between border-b border-cream/18 px-8 pt-7 pb-6">
            <span className="flex flex-col gap-1.25">
              <span className="font-serif text-xl tracking-[.28em]">{t.brand.name}</span>
              <span className="eyebrow text-[8.5px] tracking-[.3em] text-[#D8C2CF]">{r.pass}</span>
            </span>
            <span
              className={`eyebrow rounded-xs border px-2.25 py-1.25 text-[10px] ${allReady ? "border-ready-bg bg-ready-bg text-ready" : "border-cream/50 text-cream"}`}
            >
              {allReady ? r.passReady : r.passPending}
            </span>
          </div>
          <div className="flex flex-col items-center gap-5.5 p-8">
            <span className="eyebrow text-[#D8C2CF]">{r.showAtDesk}</span>
            <div className="bg-paper-3 p-5 shadow-[0_10px_30px_-12px_rgba(0,0,0,.5)]">
              <div aria-label={`QR ${code}`} role="img" className="size-48 sm:size-58 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: passSvg }} />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span className="font-serif text-[44px] leading-none tracking-[.14em]">{code}</span>
              <span className="text-[13px] text-[#D8C2CF]">{r.orTell}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 border-t border-cream/18">
            <div className="flex flex-col gap-1 border-r border-cream/18 px-8 py-4.5">
              <span className="eyebrow text-[9px] text-[#D8C2CF]">{r.member}</span>
              <span className="text-[15px]">{profile.fullName}</span>
              <span className="text-[13px] text-[#D8C2CF]">{profile.studentNumber ?? profile.cardNumber}</span>
            </div>
            <div className="flex flex-col gap-1 px-8 py-4.5">
              <span className="eyebrow text-[9px] text-[#D8C2CF]">{deadline ? r.collectBy : r.readyWhen}</span>
              <span className="text-[15px]">{deadline ? when(deadline) : r.readyWhenValue}</span>
              <span className="text-[13px] text-[#D8C2CF]">{bookCount}</span>
            </div>
          </div>
          <PassActions saveLabel={r.savePass} printLabel={r.print} svg={passSvg} code={code} />
        </aside>
      </div>

      <WeekHours t={t} />
    </>
  );
}

function Fact({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 bg-paper-3 p-5.5">
      <span className="eyebrow text-[10px] text-ink-muted">{label}</span>
      <span className="font-serif text-[26px] leading-[1.1]">{value}</span>
      <span className="text-[13px] text-ink-muted">{children}</span>
    </div>
  );
}

function WeekHours({ t }: { t: Dictionary }) {
  const r = t.reservation;
  const hours = ["08:00–22:00", "08:00–22:00", "08:00–22:00", "08:00–22:00", "08:00–22:00", "10:00–18:00", null];
  // Monday = 0 … Sunday = 6, in Istanbul.
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
    new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Europe/Istanbul" }).format(new Date()),
  );
  return (
    <section aria-labelledby="h-hours" className="bg-paper-2 pt-14 pb-16 sm:pt-18 sm:pb-22">
      <div className="container-page flex flex-wrap gap-x-18 gap-y-12">
        <div className="flex flex-[1_1_320px] flex-col gap-3.5">
          <span className="eyebrow text-plum-500">{r.hoursEyebrow}</span>
          <h2 id="h-hours" className="m-0 font-serif text-[36px] leading-[1.05] font-normal sm:text-[44px]">
            {r.hoursTitle}
          </h2>
          <p className="m-0 max-w-95 text-[15px] leading-relaxed text-ink-muted">{r.hoursText}</p>
        </div>
        <dl className="m-0 grid flex-[1_1_480px] grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-12 text-base">
          {r.days.map((day, i) => (
            <div
              key={day}
              className={`flex justify-between border-b border-line py-3.5 ${i === weekday ? "-mx-3 bg-paper-3 px-3 font-medium" : ""} ${hours[i] ? "" : "text-ink-muted"}`}
            >
              <dt>
                {day}
                {i === weekday && <span className="eyebrow ml-1.5 text-[9px] text-plum-500">{r.today}</span>}
              </dt>
              <dd className="m-0 tabular-nums">{hours[i] ?? r.closed}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
