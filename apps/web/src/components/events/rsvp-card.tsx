"use client";

import { CalendarPlus, Check } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import type { MyRsvpDto } from "@mybook/shared";
import { changeRsvp, setEventReminder, type RsvpState } from "@/app/[lang]/(site)/event-actions";
import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";

interface Props {
  slug: string;
  locale: string;
  when: string;
  capacity: number | null;
  going: number;
  waiting: number;
  memberName: string | null;
  initial: MyRsvpDto | null;
  calendar: { title: string; start: string; end: string; location: string };
  t: Dictionary["eventPage"];
}

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function downloadIcs({ title, start, end, location }: Props["calendar"], slug: string) {
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MyBook//Events//EN", "BEGIN:VEVENT", `UID:${slug}@mybook`, `DTSTAMP:${icsDate(start)}`, `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`, `SUMMARY:${title}`, `LOCATION:${location}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  Object.assign(document.createElement("a"), { href: url, download: `${slug}.ics` }).click();
  URL.revokeObjectURL(url);
}

/** The RSVP box: save a seat, see that you're going, or join the waitlist when it's full. */
export function RsvpCard(props: Props) {
  const { slug, locale, when, capacity, going, waiting, memberName, initial, t } = props;
  const [state, action, pending] = useActionState<RsvpState, FormData>(changeRsvp, { error: null, rsvp: initial ?? undefined });
  const [remind, setRemind] = useState(initial?.remind ?? true);
  const [, startTransition] = useTransition();
  const rsvp = state.rsvp ?? initial;
  const left = capacity === null ? null : Math.max(0, capacity - going);
  const full = left === 0;

  const form = (intent: "join" | "leave", label: string, className: string) => (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="lang" value={locale} />
      <input type="hidden" name="intent" value={intent} />
      <button type="submit" disabled={pending} className={`${className} disabled:cursor-wait disabled:opacity-60`}>
        {label}
      </button>
    </form>
  );
  const error = state.error && <p role="alert" className="m-0 text-sm text-overdue">{t.errors[state.error as keyof typeof t.errors] ?? t.errors.unknown}</p>;

  if (!memberName) {
    return (
      <div className="flex flex-col gap-5 p-8">
        <span className="eyebrow text-[10px] text-ink-muted">{when}</span>
        <span className="font-serif text-[34px] leading-[1.05]">{t.saveSeat}</span>
        <Link
          href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/events/${slug}`)}`}
          className="eyebrow inline-flex h-14 items-center justify-center bg-plum-700 text-xs text-paper no-underline hover:bg-plum-900"
        >
          {t.signInToRsvp}
        </Link>
        <span className="text-[13px] leading-normal text-ink-muted">{t.rsvpNote}</span>
      </div>
    );
  }

  if (rsvp?.status === "going") {
    return (
      <div role="status" className="flex animate-swap flex-col gap-4.5 p-8">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-available-bg text-available">
          <Check aria-hidden size={22} strokeWidth={1.5} />
        </span>
        <span className="font-serif text-[34px] leading-[1.05]">{t.onTheList}</span>
        <span className="text-[15px] leading-normal text-ink-muted">{format(t.seatHeld, { name: memberName })}</span>
        <label className="flex cursor-pointer items-center justify-between gap-3 border-y border-line py-3.5 text-[15px]">
          {t.remind}
          <input
            type="checkbox"
            role="switch"
            checked={remind}
            onChange={(e) => {
              setRemind(e.target.checked);
              startTransition(() => setEventReminder(slug, e.target.checked));
            }}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="relative h-5.5 w-10 flex-none rounded-full bg-line transition-colors peer-checked:bg-plum-700 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-plum-500 after:absolute after:top-0.75 after:left-0.75 after:size-4 after:rounded-full after:bg-paper-3 after:transition-transform after:duration-300 peer-checked:after:translate-x-4.5"
          />
        </label>
        <button
          type="button"
          onClick={() => downloadIcs(props.calendar, slug)}
          className="eyebrow inline-flex h-13 items-center justify-center gap-2.5 border border-ink text-[11px] text-ink hover:bg-ink hover:text-paper"
        >
          <CalendarPlus aria-hidden size={16} strokeWidth={1.5} />
          {t.addToCalendar}
        </button>
        {form("leave", t.cancel, "eyebrow h-10 w-full text-[10.5px] text-overdue underline underline-offset-5")}
        {error}
      </div>
    );
  }

  if (rsvp?.status === "waitlisted") {
    return (
      <div role="status" className="flex animate-swap flex-col gap-4.5 p-8">
        <span className="eyebrow self-start bg-ready-bg px-2.25 py-1.25 text-[10px] text-ready">{t.onWaitlist}</span>
        <span className="font-serif text-[34px] leading-[1.05]">{format(t.waitHeadline, { n: String(rsvp.waitlistPosition ?? 1) })}</span>
        <span className="text-[15px] leading-normal text-ink-muted">{t.waitPosition}</span>
        {form("leave", t.leaveWaitlist, "eyebrow h-10 w-full text-[10.5px] text-overdue underline underline-offset-5")}
        {error}
      </div>
    );
  }

  if (full) {
    return (
      <div className="flex animate-swap flex-col gap-4.5 p-8">
        <span className="eyebrow self-start bg-overdue-bg px-2.25 py-1.25 text-[10px] text-overdue">{t.fullBadge}</span>
        <span className="font-serif text-[34px] leading-[1.05]">{format(t.allTaken, { count: String(capacity) })}</span>
        <span className="text-[15px] leading-normal text-ink-muted">{waiting ? format(t.peopleWaiting, { count: String(waiting) }) : t.nobodyWaiting}</span>
        {form("join", format(t.joinWaitlist, { n: String(waiting + 1) }), "eyebrow h-14 w-full border border-ink text-xs text-ink hover:bg-ink hover:text-paper")}
        {error}
      </div>
    );
  }

  return (
    <div className="flex animate-swap flex-col gap-5 p-8">
      <span className="eyebrow text-[10px] text-ink-muted">{when}</span>
      <span className="font-serif text-[34px] leading-[1.05]">{t.saveSeat}</span>
      {capacity !== null && left !== null && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span>{format(t.seatsLeftLine, { left: String(left), total: String(capacity) })}</span>
            <span className="text-ink-muted">{format(t.going, { count: String(going) })}</span>
          </div>
          <div className="flex h-1 bg-line">
            <div className="bg-plum-700" style={{ width: `${(going / capacity) * 100}%` }} />
          </div>
        </div>
      )}
      {form("join", t.rsvpButton, "eyebrow h-14 w-full bg-plum-700 text-xs text-paper hover:bg-plum-900")}
      {error}
      <span className="text-[13px] leading-normal text-ink-muted">{t.rsvpNote}</span>
    </div>
  );
}
