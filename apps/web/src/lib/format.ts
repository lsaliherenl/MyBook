import type { Locale } from "@/i18n/config";

const TIME_ZONE = "Europe/Istanbul";
const intlLocale = (locale: Locale) => (locale === "tr" ? "tr-TR" : "en-US");

/** "Per, 12 Kas" · "Thu, Nov 12" */
export function formatDay(iso: string | Date, locale: Locale): string {
  const formatter = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", day: "numeric", month: "short", timeZone: TIME_ZONE });
  if (locale !== "tr") return formatter.format(new Date(iso));
  // Turkish Intl gives "12 Kas Per"; the design (and Turkish print style) puts the weekday first.
  const part = (type: Intl.DateTimeFormatPartTypes) => formatter.formatToParts(new Date(iso)).find((p) => p.type === type)?.value;
  return `${part("weekday")}, ${part("day")} ${part("month")}`;
}

/** "3 Kas" · "Nov 3" */
export function formatShortDate(iso: string | Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", timeZone: TIME_ZONE }).format(new Date(iso));
}

/** "Almanca" · "German" for an ISO 639-1 code. */
export function languageName(code: string, locale: Locale): string {
  const name = new Intl.DisplayNames([intlLocale(locale)], { type: "language" }).of(code) ?? code;
  return name.charAt(0).toLocaleUpperCase(intlLocale(locale)) + name.slice(1);
}

/** "19:00" · "7:00 PM" — Turkish uses the 24-hour clock. */
export function formatTime(iso: string | Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { hour: "numeric", minute: "2-digit", timeZone: TIME_ZONE }).format(
    new Date(iso),
  );
}

/** "₺2,50" · "₺2.50" */
export function formatMoney(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "TRY", currencyDisplay: "narrowSymbol", minimumFractionDigits: 2 }).format(
    amount,
  );
}

/** "12.480" · "12,480" */
export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

/** Month name for section eyebrows: "Ekim" · "October". */
export function formatMonth(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { month: "long", timeZone: TIME_ZONE }).format(date);
}

/** Picks the Turkish or English field of a bilingual record: localized(category, "name", "tr") → category.nameTr. */
export function localized<T extends object, K extends string>(record: T, field: K, locale: Locale): T[`${K}Tr` & keyof T] {
  return record[`${field}${locale === "tr" ? "Tr" : "En"}` as `${K}Tr` & keyof T];
}
