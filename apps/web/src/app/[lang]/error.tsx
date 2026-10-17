"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { Shelf, SystemCopy, SystemShell } from "@/components/system/system-shell";
import { SYSTEM_TEXT } from "@/i18n/system";

/** A12 500: something failed while rendering. Loans and the bag are server-side, so nothing is lost. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ lang: string }>();
  const locale = params.lang === "en" ? "en" : "tr";
  const s = SYSTEM_TEXT[locale];
  useEffect(() => console.error(error), [error]);
  const reference = (error.digest ?? "").toUpperCase().slice(0, 9);

  return (
    <SystemShell locale={locale}>
      <Shelf kind="serverError" />
      <SystemCopy kind="serverError" locale={locale}>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-6 gap-y-4">
          <button type="button" onClick={reset} className="eyebrow h-13 bg-plum-700 px-6.5 text-[11px] text-paper hover:bg-plum-900">
            {s.tryAgain}
          </button>
          <Link href={`/${locale}/status`} className="eyebrow text-[11px] text-ink underline decoration-line underline-offset-5 hover:text-plum-500">
            {s.status}
          </Link>
        </div>
        {reference && <span className="text-[13px] text-ink-muted">{s.reference.replace("{ref}", reference)}</span>}
      </SystemCopy>
    </SystemShell>
  );
}
