"use client";

import type { Locale } from "@/i18n/config";
import { formatMonth } from "@/lib/format";
import { useMounted } from "@/lib/use-mounted";

/** This month's name ("Ekim"), worked out in the browser so cached pages never show last month. */
export function CurrentMonth({ locale }: { locale: Locale }) {
  const mounted = useMounted();
  return <span>{mounted ? formatMonth(new Date(), locale) : " "}</span>;
}
