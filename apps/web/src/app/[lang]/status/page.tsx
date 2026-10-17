import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { SystemShell } from "@/components/system/system-shell";
import type { Locale } from "@/i18n/config";
import { getLocale } from "@/i18n/get-dictionary";
import { SYSTEM_TEXT } from "@/i18n/system";
import { formatTime } from "@/lib/format";

export const metadata: Metadata = { title: "Status", robots: { index: false } };

/** "Site status" from the footer: is the website up, and can it reach the API and its database? */
export default async function StatusPage() {
  const locale = await getLocale();
  const s = SYSTEM_TEXT[locale];
  return (
    <SystemShell locale={locale}>
      <div className="flex max-w-160 flex-[1_1_480px] flex-col gap-6">
        <span className="eyebrow text-plum-500">{s.status}</span>
        <h1 className="m-0 font-serif text-[48px] leading-[.98] font-light sm:text-[clamp(48px,5vw,76px)]">{s.statusTitle}</h1>
        <p className="m-0 text-lg font-light text-ink-muted">{s.statusIntro}</p>
        <Suspense fallback={<div className="h-32 animate-pulse bg-paper-2" />}>
          <Checks locale={locale} />
        </Suspense>
      </div>
    </SystemShell>
  );
}

async function apiHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.API_URL ?? "http://localhost:4000/api"}/health`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function Checks({ locale }: { locale: Locale }) {
  await connection();
  const s = SYSTEM_TEXT[locale];
  const rows = [
    { label: s.statusWeb, ok: true },
    { label: s.statusApi, ok: await apiHealthy() },
  ];
  return (
    <>
      <ul className="m-0 list-none border-t border-line p-0">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-4 border-b border-line py-4 text-base">
            {row.label}
            <span className={`eyebrow inline-flex items-center gap-2 rounded-xs px-2.5 py-1.5 text-[10px] ${row.ok ? "bg-available-bg text-available" : "bg-overdue-bg text-overdue"}`}>
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              {row.ok ? s.statusOk : s.statusDown}
            </span>
          </li>
        ))}
      </ul>
      <span className="text-[13px] text-ink-muted">{s.statusChecked.replace("{time}", formatTime(new Date(), locale))}</span>
    </>
  );
}
