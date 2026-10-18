"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EVENT_KINDS, type AdminEventDto, type AdminEventList, type EventAttendeeDto, type EventKind, type SaveEventInput } from "@mybook/shared";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import { initials, localized } from "@/lib/format";
import { createEvent, deleteEvent, updateEvent } from "./actions";

type Text = Dictionary["admin"]["programme"];

const TIME_ZONE = "Europe/Istanbul";
const LABEL = "eyebrow text-[10px] text-ink-muted";
const FIELD = "h-11 w-full rounded-xs border border-line bg-paper px-3.5 text-[15px] text-ink outline-none focus:border-plum-500";
const AVATARS = ["bg-[#55684f]", "bg-gold", "bg-[#8e4a36]", "bg-ink-muted", "bg-plum-700", "bg-plum-500"];

/** Istanbul calendar date and clock time of an instant, as the form's inputs expect them. */
function local(iso: string | null) {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TIME_ZONE }).format(d);
  return { date, time };
}

/** Istanbul is UTC+3 all year, so a local date and time map to one fixed-offset instant. */
const instant = (date: string, time: string) => new Date(`${date}T${time}:00+03:00`).toISOString();

/** B18 editor panel: everything about one event, its sign-ups, and publishing or deleting it. */
export function EventEditor({
  event,
  attendees,
  locale,
  text: p,
  kinds,
  base,
  list,
}: {
  event: AdminEventDto | null;
  attendees: EventAttendeeDto[];
  locale: Locale;
  text: Text;
  kinds: Record<EventKind, string>;
  base: string;
  list: AdminEventList;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [rsvp, setRsvp] = useState(event?.rsvpRequired ?? true);
  const [published, setPublished] = useState(event?.published ?? false);
  const [limited, setLimited] = useState(event ? event.capacity !== null : true);
  const [capacity, setCapacity] = useState(event?.capacity ?? 40);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const start = local(event?.startsAt ?? null);
  const end = local(event?.endsAt ?? null);
  const going = attendees.filter((a) => !a.waitlisted);
  const waiting = attendees.length - going.length;
  const minSeats = Math.max(1, going.length);

  function save(form: FormData) {
    const get = (name: string) => String(form.get(name) ?? "").trim();
    const date = get("date");
    const startTime = get("start");
    const endTime = get("end");
    let endsAt: string | null = null;
    if (endTime) {
      const endDate = get("endDate") || date;
      endsAt = instant(endDate, endTime);
      // "20:00 – 00:30" on one day means the next morning.
      if (!get("endDate") && endsAt <= instant(date, startTime)) endsAt = new Date(new Date(endsAt).getTime() + 86_400_000).toISOString();
    }
    if (endsAt && endsAt <= instant(date, startTime)) return setMessage({ tone: "error", text: p.errors.invalid });
    const input: SaveEventInput = {
      kind: get("kind") as EventKind,
      titleTr: get("titleTr"),
      titleEn: get("titleEn"),
      descriptionTr: get("descriptionTr") || null,
      descriptionEn: get("descriptionEn") || null,
      locationTr: get("locationTr"),
      locationEn: get("locationEn"),
      startsAt: instant(date, startTime),
      endsAt,
      rsvpRequired: rsvp,
      capacity: rsvp && limited ? capacity : null,
      published,
    };
    setMessage(null);
    startTransition(async () => {
      const result = event ? await updateEvent(event.id, input) : await createEvent(input);
      if (!result.ok) return setMessage({ tone: "error", text: p.errors.unknown });
      setMessage({ tone: "ok", text: published ? p.saved : p.savedDraft });
      if (!event) router.replace(`${base}?list=${published ? "upcoming" : "drafts"}&id=${result.data.id}`);
    });
  }

  function remove() {
    if (!event) return;
    if (!confirmDelete) return setConfirmDelete(true);
    startTransition(async () => {
      const result = await deleteEvent(event.id);
      if (result.ok) router.replace(`${base}?list=${list}`);
      else setMessage({ tone: "error", text: p.errors.unknown });
    });
  }

  const toggle = (on: boolean, flip: () => void, label: string, hint: string) => (
    <button type="button" role="switch" aria-checked={on} onClick={flip} className="flex items-center justify-between gap-3.5 text-left text-ink">
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px]">{label}</span>
        <span className="text-xs text-ink-muted">{hint}</span>
      </span>
      <span aria-hidden className={`relative h-5.5 w-10 flex-none rounded-full transition-colors ${on ? "bg-plum-700" : "bg-line"}`}>
        <span className={`absolute top-0.75 size-4 rounded-full bg-paper-3 transition-[left] ${on ? "left-5.25" : "left-0.75"}`} />
      </span>
    </button>
  );

  return (
    <aside aria-labelledby="ed-h" className="flex max-w-140 min-w-0 flex-[2_1_400px] animate-swap flex-col border-l border-line bg-paper-3">
      <div className="flex items-start justify-between gap-4 border-b border-line px-7 pt-6 pb-4.5">
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>{event ? `${kinds[event.kind]} · ${event.published ? p.statuses.published : p.statuses.draft}` : p.editorNew}</span>
          <h2 id="ed-h" className="m-0 font-serif text-[28px] leading-[1.1] font-normal">
            {event ? localized(event, "title", locale) : p.untitled}
          </h2>
        </div>
        <Link href={`${base}?list=${list}`} aria-label={p.close} className="inline-flex size-10 flex-none items-center justify-center text-ink hover:text-plum-500">
          <X aria-hidden size={20} strokeWidth={1.5} />
        </Link>
      </div>

      <form
        id="event-form"
        onSubmit={(e) => {
          e.preventDefault();
          save(new FormData(e.currentTarget));
        }}
        className="flex flex-1 flex-col gap-4 px-7 py-5.5"
      >
        {message && (
          <p role={message.tone === "error" ? "alert" : "status"} className={`m-0 px-3.5 py-3 text-sm ${message.tone === "error" ? "bg-overdue-bg text-overdue" : "bg-available-bg text-available"}`}>
            {message.text}
          </p>
        )}
        <label className="flex flex-col gap-2">
          <span className={LABEL}>{p.titleTr}</span>
          <input name="titleTr" required minLength={2} maxLength={200} defaultValue={event?.titleTr ?? ""} lang="tr" className={FIELD} />
        </label>
        <label className="flex flex-col gap-2">
          <span className={LABEL}>{p.titleEn}</span>
          <input name="titleEn" required minLength={2} maxLength={200} defaultValue={event?.titleEn ?? ""} lang="en" className={FIELD} />
        </label>
        <label className="flex flex-col gap-2">
          <span className={LABEL}>{p.kind}</span>
          <select name="kind" defaultValue={event?.kind ?? "BOOK_CLUB"} className={FIELD}>
            {EVENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {kinds[k]}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.3fr_1fr_1fr]">
          <label className="flex flex-col gap-2">
            <span className={LABEL}>{p.date}</span>
            <input name="date" type="date" required defaultValue={start.date} className={FIELD} />
          </label>
          <label className="flex flex-col gap-2">
            <span className={LABEL}>{p.starts}</span>
            <input name="start" type="time" required defaultValue={start.time || "19:00"} className={FIELD} />
          </label>
          <label className="flex flex-col gap-2">
            <span className={LABEL}>{p.ends}</span>
            <input name="end" type="time" defaultValue={end.time} className={FIELD} />
          </label>
        </div>
        <label className="flex flex-col gap-2">
          <span className={LABEL}>{p.endDate}</span>
          <input name="endDate" type="date" defaultValue={end.date && end.date !== start.date ? end.date : ""} className={FIELD} />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className={LABEL}>{p.locationTr}</span>
            <input name="locationTr" required minLength={2} list="places-tr" defaultValue={event?.locationTr ?? ""} className={FIELD} />
          </label>
          <label className="flex flex-col gap-2">
            <span className={LABEL}>{p.locationEn}</span>
            <input name="locationEn" required minLength={2} list="places-en" defaultValue={event?.locationEn ?? ""} className={FIELD} />
          </label>
          <datalist id="places-tr">
            {p.placesTr.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          <datalist id="places-en">
            {p.places.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </div>
        {(["descriptionTr", "descriptionEn"] as const).map((name) => (
          <label key={name} className="flex flex-col gap-2">
            <span className={LABEL}>{p[name]}</span>
            <textarea
              name={name}
              rows={3}
              maxLength={4000}
              defaultValue={event?.[name] ?? ""}
              placeholder={p.descriptionHint}
              className="resize-y rounded-xs border border-line bg-paper px-3.5 py-3 text-[15px] leading-[1.55] text-ink outline-none focus:border-plum-500"
            />
          </label>
        ))}

        <div className="flex flex-col gap-3.5 border-y border-line py-4">
          {toggle(published, () => setPublished((v) => !v), p.published, p.publishedHint)}
          {toggle(rsvp, () => setRsvp((v) => !v), p.rsvp, p.rsvpHint)}
          {rsvp && (
            <>
              <label className="flex items-center gap-2.5 text-sm">
                <input type="checkbox" checked={!limited} onChange={(e) => setLimited(!e.target.checked)} className="size-4 accent-plum-700" />
                {p.openSeating}
              </label>
              {limited && (
                <div className="flex items-center justify-between gap-3.5">
                  <span className="text-[15px]">{p.seats}</span>
                  <span className="inline-flex items-center border border-line bg-paper">
                    <button type="button" aria-label={p.fewer} onClick={() => setCapacity((c) => Math.max(minSeats, c - 5))} className="size-10 text-lg text-ink">
                      −
                    </button>
                    <input
                      aria-label={p.seats}
                      inputMode="numeric"
                      value={capacity}
                      onChange={(e) => setCapacity(Math.max(1, Math.min(2000, Number(e.target.value.replace(/\D/g, "")) || 1)))}
                      className="w-13 border-0 bg-transparent text-center text-base tabular-nums outline-none"
                    />
                    <button type="button" aria-label={p.more} onClick={() => setCapacity((c) => Math.min(2000, c + 5))} className="size-10 text-lg text-ink">
                      +
                    </button>
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {event && event.rsvpRequired && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow text-[10px]">{p.rsvpsTitle}</span>
              {attendees.length > 0 && (
                <a href={`${base}/${event.id}/attendees.csv`} className="eyebrow text-[9px] text-ink hover:text-plum-500">
                  {p.exportAttendees}
                </a>
              )}
            </div>
            {attendees.length === 0 ? (
              <span className="text-sm text-ink-muted">{p.noRsvps}</span>
            ) : (
              <>
                <span className="text-[15px]">
                  {[
                    event.capacity !== null
                      ? format(p.rsvpLine, { going: String(going.length), left: String(Math.max(0, event.capacity - going.length)) })
                      : format(p.rsvpLineOpen, { going: String(going.length) }),
                    waiting ? format(p.rsvpWaitlist, { count: String(waiting) }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <div className="flex items-center">
                  {going.slice(0, 6).map((a, i) => (
                    <span
                      key={a.memberId}
                      title={a.fullName}
                      className={`-mr-1.5 inline-flex size-8 items-center justify-center rounded-full border-2 border-paper-3 font-serif text-xs text-paper ${AVATARS[i % AVATARS.length]}`}
                    >
                      {initials(a.fullName)}
                    </span>
                  ))}
                  {going.length > 6 && <span className="ml-3.5 text-[13px] text-ink-muted">{format(p.moreAttendees, { count: String(going.length - 6) })}</span>}
                </div>
              </>
            )}
          </div>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-2.5 border-t border-line bg-paper-2/40 px-7 py-4.5">
        <button type="submit" form="event-form" disabled={pending} className="eyebrow h-11.5 bg-plum-700 px-5.5 text-[10px] text-paper hover:bg-plum-900 disabled:opacity-60">
          {pending ? p.saving : !event ? (published ? p.publish : p.saveDraft) : !event.published && published ? p.publish : p.save}
        </button>
        {event?.published && (
          <a href={`/${locale}/events/${event.slug}`} target="_blank" rel="noreferrer" className="eyebrow inline-flex h-11.5 items-center border border-ink px-4.5 text-[10px] text-ink no-underline hover:bg-ink hover:text-paper">
            {p.preview}
          </a>
        )}
        {event && (
          <button type="button" disabled={pending} onClick={remove} className="eyebrow ml-auto h-11.5 px-3.5 text-[10px] text-overdue hover:underline disabled:opacity-50">
            {p.delete}
          </button>
        )}
        {confirmDelete && <p className="m-0 w-full text-[13px] text-overdue">{p.deleteConfirm}</p>}
      </div>
    </aside>
  );
}
