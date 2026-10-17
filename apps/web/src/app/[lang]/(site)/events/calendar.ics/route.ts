import type { EventDto } from "@mybook/shared";
import { isLocale } from "@/i18n/config";
import { api } from "@/lib/api";

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** Escapes text for iCalendar (RFC 5545 §3.3.11). */
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** "Subscribe to calendar": every upcoming event as an iCalendar feed. */
export async function GET(_request: Request, { params }: RouteContext<"/[lang]/events/calendar.ics">) {
  const { lang } = await params;
  const tr = !isLocale(lang) || lang === "tr";
  const events = await api<EventDto[]>("/events?when=upcoming&limit=50").catch(() => []);
  const now = icsDate(new Date().toISOString());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MyBook//Events//EN", "X-WR-CALNAME:MY / BOOK", "X-WR-TIMEZONE:Europe/Istanbul"];
  for (const e of events) {
    const end = e.endsAt ?? new Date(new Date(e.startsAt).getTime() + 2 * 3_600_000).toISOString();
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.slug}@mybook`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsDate(e.startsAt)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsText(tr ? e.titleTr : e.titleEn)}`,
      `LOCATION:${icsText(tr ? e.locationTr : e.locationEn)}`,
      ...(e.descriptionTr || e.descriptionEn ? [`DESCRIPTION:${icsText((tr ? e.descriptionTr : e.descriptionEn) ?? "")}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n"), {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": 'inline; filename="mybook-events.ics"', "cache-control": "public, max-age=900" },
  });
}
