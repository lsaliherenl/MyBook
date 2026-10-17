"use client";

import { formatMonth } from "@/lib/format";
import type { Locale } from "@/i18n/config";

/** This month's name ("Ekim"), rendered in the browser so cached pages never show last month. */
export function CurrentMonth({ locale }: { locale: Locale }) {
  return <span suppressHydrationWarning>{formatMonth(new Date(), locale)}</span>;
}
