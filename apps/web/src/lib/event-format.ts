import type { EventDto } from "@mybook/shared";
import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { formatShortDate, formatTime } from "./format";

const TZ = "Europe/Istanbul";
const intl = (locale: Locale) => (locale === "tr" ? "tr-TR" : "en-US");
const sameDay = (a: Date, b: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(a) === new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(b);

/** The calendar block on event rows: "Per" / "12" / "Kas". */
export function dateBlock(iso: string, locale: Locale) {
  const date = new Date(iso);
  const part = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intl(locale), { ...opts, timeZone: TZ }).format(date);
  return { weekday: part({ weekday: "short" }), day: part({ day: "2-digit" }), month: part({ month: "short" }) };
}

/** "19:00", "14:00 – 15:30", or "2 Kas – 15 Kas" for events spanning days. */
export function timeRange(event: Pick<EventDto, "startsAt" | "endsAt">, locale: Locale) {
  if (!event.endsAt) return formatTime(event.startsAt, locale);
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  if (!sameDay(start, end)) return `${formatShortDate(start, locale)} – ${formatShortDate(end, locale)}`;
  return `${formatTime(start, locale)} – ${formatTime(end, locale)}`;
}

/** "12 Kasım Perşembe" · "Thursday, November 12" */
export function longDay(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(intl(locale), { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(new Date(iso));
}

export function seatsLeft(event: EventDto) {
  return event.capacity === null ? null : Math.max(0, event.capacity - event.registered);
}

/** Seat line and the matching colour: plenty, few, full, open seating. */
export function seatsLine(event: EventDto, t: Dictionary["events"]): { text: string; tone: string } {
  if (!event.rsvpRequired) return { text: event.kind === "NOTICE" ? "" : event.kind === "WORKSHOP" ? t.dropIn : t.openSeating, tone: "text-available" };
  const left = seatsLeft(event);
  if (left === null) return { text: t.openSeating, tone: "text-available" };
  if (left === 0) return { text: event.waitlisted ? format(t.full, { count: String(event.waitlisted) }) : t.fullNoWait, tone: "text-overdue" };
  if (left <= 6) return { text: format(t.fewSeats, { count: String(left) }), tone: "text-ready" };
  return { text: format(t.seatsLeft, { left: String(left), total: String(event.capacity) }), tone: "text-available" };
}

