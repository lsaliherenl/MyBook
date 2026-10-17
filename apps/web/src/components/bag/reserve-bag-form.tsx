"use client";

import { useActionState } from "react";
import { reserveBag, type ReserveState } from "@/app/[lang]/(site)/bag-actions";

export function ReserveBagForm({ locale, label, errors }: { locale: string; label: string; errors: Record<string, string> }) {
  const [state, action, pending] = useActionState<ReserveState, FormData>(reserveBag, { error: null });
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="lang" value={locale} />
      {state.error && (
        <p role="alert" className="m-0 border-l-2 border-overdue bg-overdue-bg px-3.5 py-2.5 text-sm text-overdue">
          {errors[state.error] ?? errors.unknown}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="eyebrow flex h-13.5 items-center justify-center bg-plum-700 text-paper hover:bg-plum-900 disabled:cursor-wait disabled:opacity-70"
      >
        {label}
      </button>
    </form>
  );
}
