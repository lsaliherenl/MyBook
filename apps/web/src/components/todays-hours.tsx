"use client";

import { useMounted } from "@/lib/use-mounted";

/**
 * "open until 22:00" for today in Istanbul (Saturdays 18:00, closed on Sundays), worked out in the
 * browser. The desk closes a quarter of an hour earlier and passes its own times.
 */
export function TodaysHours({
  openUntil,
  closedToday,
  weekdays = "22:00",
  saturday = "18:00",
}: {
  openUntil: string;
  closedToday: string;
  weekdays?: string;
  saturday?: string;
}) {
  const mounted = useMounted();
  if (!mounted) return null;
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Europe/Istanbul" }).format(new Date());
  const closing = day === "Sun" ? null : day === "Sat" ? saturday : weekdays;
  return <span>{closing ? openUntil.replace("{time}", closing) : closedToday}</span>;
}
