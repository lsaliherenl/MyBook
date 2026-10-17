"use client";

/** "open until 22:00" for today in Istanbul (Saturdays 18:00, closed on Sundays), computed in the browser. */
export function TodaysHours({ openUntil, closedToday }: { openUntil: string; closedToday: string }) {
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Europe/Istanbul" }).format(new Date());
  const closing = day === "Sun" ? null : day === "Sat" ? "18:00" : "22:00";
  return <span suppressHydrationWarning>{closing ? openUntil.replace("{time}", closing) : closedToday}</span>;
}
