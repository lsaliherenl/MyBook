import Link from "next/link";
import type { Dictionary } from "@/i18n/get-dictionary";

/** "Sign in | Create account" — two pages that look like tabs. */
export function AuthTabs({ current, locale, t, next }: { current: "login" | "register"; locale: string; t: Dictionary["auth"]; next?: string }) {
  const query = next ? `?next=${encodeURIComponent(next)}` : "";
  const tab = (key: "login" | "register", label: string) => (
    <Link
      href={`/${locale}/${key}${query}`}
      aria-current={current === key ? "page" : undefined}
      className={`-mb-px inline-flex h-13 items-center justify-center border-b-2 text-[15px] no-underline md:h-12 md:justify-start ${
        current === key ? "border-plum-700 text-ink" : "border-transparent text-ink-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label={t.tabs} className="grid grid-cols-2 border-b border-line md:flex md:gap-8">
      {tab("login", t.signInTab)}
      {tab("register", t.registerTab)}
    </nav>
  );
}

export function AuthHeading({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      {eyebrow && <span className="eyebrow hidden text-plum-500 md:block">{eyebrow}</span>}
      <h1 className="m-0 font-serif text-[44px] leading-none font-light md:text-[60px] md:leading-[.98]">{title}</h1>
    </div>
  );
}
