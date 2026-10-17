"use client";

import { useMounted } from "@/lib/use-mounted";

/** "open until 22:00" for today in Istanbul (Saturdays 18:00, closed on Sundays), worked out in the browser. */
export function TodaysHours({ openUntil, closedToday }: { openUntil: string; closedToday: string }) {
  const mounted = useMounted();
  if (!mounted) return null;
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Europe/Istanbul" }).format(new Date());
  const closing = day === "Sun" ? null : day === "Sat" ? "18:00" : "22:00";
  return <span>{closing ? openUntil.replace("{time}", closing) : closedToday}</span>;
}
