"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Links to the same page in the other language: /tr/account ↔ /en/account. */
export function LanguageSwitch({ label }: { label: string }) {
  const pathname = usePathname();
  const [, current, ...rest] = pathname.split("/");
  const other = current === "en" ? "tr" : "en";
  return (
    <Link href={`/${other}/${rest.join("/")}`} hrefLang={other} className="eyebrow text-ink-muted hover:text-plum-500">
      {label}
    </Link>
  );
}
