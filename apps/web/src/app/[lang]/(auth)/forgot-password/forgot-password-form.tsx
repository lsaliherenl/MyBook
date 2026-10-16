"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import type { Dictionary } from "@/i18n/get-dictionary";
import { requestPasswordReset } from "../actions";

export function ForgotPasswordForm({ locale, t }: { locale: string; t: Dictionary["auth"] }) {
  const [state, action] = useActionState(requestPasswordReset, null);
  if (state?.done) return <FormMessage tone="success">{t.forgotSent}</FormMessage>;

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="lang" value={locale} />
      {state?.error ? <FormMessage tone="error">{t.errors[state.error]}</FormMessage> : null}
      <Field label={t.email} name="email" type="email" autoComplete="email" required invalid={state?.fields?.includes("email")} />
      <SubmitButton>{t.forgotButton} →</SubmitButton>
    </form>
  );
}
