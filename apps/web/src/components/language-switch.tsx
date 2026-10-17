"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";

const LOCALES: Locale[] = ["tr", "en"];

/** Same page in the other language: /tr/books/x ↔ /en/books/x. */
function useLocaleHref() {
  const pathname = usePathname();
  const [, , ...rest] = pathname.split("/");
  return (locale: Locale) => `/${locale}${rest.length ? `/${rest.join("/")}` : ""}`;
}

function useCurrentLocale(): Locale {
  return usePathname().split("/")[1] === "en" ? "en" : "tr";
}

/** "TR EN" in the header, the current one underlined in plum. */
export function LanguageSwitch({ label, className = "inline-flex" }: { label: string; className?: string }) {
  return <LanguageLinks label={label} className={className} href={useLocaleHref()} current={useCurrentLocale()} />;
}

/** Fallback while a dynamic page streams in: plain links to each language's home page. */
export function LanguageLinks({
  label,
  className = "inline-flex",
  href = (l) => `/${l}`,
  current,
}: {
  label: string;
  className?: string;
  href?: (locale: Locale) => string;
  current?: Locale;
}) {
  return (
    <div role="group" aria-label={label} className={className}>
      {LOCALES.map((l) => (
        <Link
          key={l}
          href={href(l)}
          hrefLang={l}
          lang={l}
          aria-current={l === current ? "true" : undefined}
          className={`eyebrow inline-flex h-11 items-center px-2 text-xs no-underline ${
            l === current ? "text-ink underline decoration-plum-500 underline-offset-6" : "text-ink-muted hover:text-ink"
          }`}
        >
          {l.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}

/** "Türkçe | English" segmented control in the footer. */
export function LanguageToggle({ label, names }: { label: string; names: Record<Locale, string> }) {
  const href = useLocaleHref();
  const current = useCurrentLocale();
  return (
    <div role="group" aria-label={label} className="inline-flex self-start border border-cream-2">
      {LOCALES.map((l) => (
        <Link
          key={l}
          href={href(l)}
          hrefLang={l}
          lang={l}
          aria-current={l === current ? "true" : undefined}
          className={`eyebrow inline-flex h-11 items-center px-4.5 no-underline ${
            l === current ? "bg-cream-2 text-plum-900" : "text-cream-2 hover:bg-cream-2/10"
          }`}
        >
          {names[l]}
        </Link>
      ))}
    </div>
  );
}
