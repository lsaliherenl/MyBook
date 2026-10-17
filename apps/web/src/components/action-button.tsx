"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/[lang]/(site)/circulation-actions";
import type { Locale } from "@/i18n/config";
import { formatDay } from "@/lib/format";

/**
 * A one-button form for a circulation server action (reserve, renew, cancel). Refusals from the API
 * come back as codes and are shown in the member's language under the button.
 */
export function ActionButton({
  action,
  fields,
  label,
  errors,
  className,
  success,
  locale,
  children,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  label: string;
  errors: Record<string, string>;
  className: string;
  /** Shown instead of the button once the action succeeds; "{date}" becomes the date the action returned. */
  success?: string;
  locale?: Locale;
  children?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const done = state.error === null && state.message !== undefined;

  return (
    <form action={formAction} className="contents">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {done && success ? (
        <span role="status" className="animate-swap text-sm text-available">
          {state.message && locale ? success.replace("{date}", formatDay(state.message, locale)) : success}
        </span>
      ) : (
        <button type="submit" disabled={pending} className={`${className} disabled:cursor-wait disabled:opacity-60`}>
          {children}
          {label}
        </button>
      )}
      {state.error && (
        <p role="alert" className="m-0 w-full basis-full border-l-2 border-overdue bg-overdue-bg px-3.5 py-2.5 text-sm text-overdue">
          {errors[state.error] ?? errors.unknown}
        </p>
      )}
    </form>
  );
}
