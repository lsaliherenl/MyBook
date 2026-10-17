"use client";

import { CalendarPlus, Download, Printer } from "lucide-react";

function download(name: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  link.click();
  URL.revokeObjectURL(url);
}

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** "Add to calendar": an .ics event covering the pickup window. */
export function AddToCalendarButton({ label, title, start, end, location, code }: { label: string; title: string; start: string; end: string; location: string; code: string }) {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MyBook//Library//EN",
    "BEGIN:VEVENT",
    `UID:${code}-${icsDate(start)}@mybook`,
    `DTSTAMP:${icsDate(start)}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${title}`,
    `LOCATION:${location}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return (
    <button
      type="button"
      onClick={() => download(`mybook-${code}.ics`, "text/calendar", ics)}
      className="eyebrow inline-flex h-13 items-center gap-2.5 border border-ink px-5.5 text-xs text-ink hover:bg-ink hover:text-paper"
    >
      <CalendarPlus aria-hidden size={16} strokeWidth={1.5} />
      {label}
    </button>
  );
}

/** "Save pass" downloads the pass as an SVG; "Print" prints only the pass (see globals.css @media print). */
export function PassActions({ saveLabel, printLabel, svg, code }: { saveLabel: string; printLabel: string; svg: string; code: string }) {
  const cell = "eyebrow inline-flex h-14 flex-1 items-center justify-center gap-2.5 text-[10.5px] text-cream hover:bg-white/8";
  return (
    <div className="flex border-t border-cream/18 print:hidden">
      <button type="button" onClick={() => download(`mybook-${code}.svg`, "image/svg+xml", svg)} className={`${cell} border-r border-cream/18`}>
        <Download aria-hidden size={16} strokeWidth={1.5} />
        {saveLabel}
      </button>
      <button type="button" onClick={() => window.print()} className={cell}>
        <Printer aria-hidden size={16} strokeWidth={1.5} />
        {printLabel}
      </button>
    </div>
  );
}
