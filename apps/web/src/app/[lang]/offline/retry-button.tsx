"use client";

export function RetryButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.location.reload()} className="eyebrow h-13 px-4 text-[11px] text-ink underline underline-offset-5 hover:text-plum-500">
      {label}
    </button>
  );
}
