"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import type { Dictionary } from "@/i18n/get-dictionary";
import { updatePassword } from "../../(auth)/actions";

export function PasswordForm({ t }: { t: Dictionary["auth"] }) {
  const [state, action] = useActionState(updatePassword, null);
  if (state?.done) return <FormMessage tone="success">{t.resetDone}</FormMessage>;

  return (
    <form action={action} className="space-y-6">
      {state?.error ? <FormMessage tone="error">{t.errors[state.error]}</FormMessage> : null}
      <Field
        label={t.newPassword}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        invalid={state?.fields?.includes("password")}
      />
      <SubmitButton>{t.resetButton} →</SubmitButton>
    </form>
  );
}
