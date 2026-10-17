import type { Metadata } from "next";
import { Shelf, SystemCopy, SystemShell } from "@/components/system/system-shell";
import { getLocale } from "@/i18n/get-dictionary";
import { SYSTEM_TEXT } from "@/i18n/system";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = { robots: { index: false } };

/** A12 offline: the service worker (public/sw.js) shows this page when a page can't be loaded and isn't cached. */
export default async function OfflinePage() {
  const locale = await getLocale();
  const s = SYSTEM_TEXT[locale];
  const button = "eyebrow inline-flex h-13 items-center px-6 text-[11px] no-underline";
  return (
    <SystemShell locale={locale}>
      <Shelf kind="offline" />
      <SystemCopy kind="offline" locale={locale}>
        <div className="mt-1.5 flex flex-wrap gap-3">
          <a href={`/${locale}/account/loans?tab=reservations`} className={`${button} bg-plum-700 text-paper hover:bg-plum-900`}>
            {s.pass}
          </a>
          <a href={`/${locale}/account`} className={`${button} border border-ink text-ink hover:bg-ink hover:text-paper`}>
            {s.card}
          </a>
          <RetryButton label={s.retry} />
        </div>
      </SystemCopy>
    </SystemShell>
  );
}
