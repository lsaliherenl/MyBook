"use client";

import { Printer } from "lucide-react";

/** Opens the browser's print dialog ("Save as PDF" lives there). */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="eyebrow inline-flex h-11 items-center gap-2 border border-ink px-4.5 text-[10px] text-ink hover:bg-ink hover:text-paper print:hidden"
    >
      <Printer aria-hidden size={16} strokeWidth={1.5} />
      {label}
    </button>
  );
}
