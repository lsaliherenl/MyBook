import { DEFAULT_LOCALE, LOCALES, type Locale } from "@mybook/shared";

export { DEFAULT_LOCALE, LOCALES, type Locale };

export const LOCALE_COOKIE = "MYBOOK_LOCALE";

export function isLocale(value: string | undefined | null): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** Picks tr or en from an Accept-Language header, preferring whichever the browser lists first. */
export function localeFromAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.slice(0, 2).toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  return ranked.find((r) => isLocale(r.lang))?.lang as Locale | undefined ?? DEFAULT_LOCALE;
}
