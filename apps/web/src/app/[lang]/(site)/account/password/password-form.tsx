"use client";

import { useActionState } from "react";
import { updatePassword } from "@/app/[lang]/(auth)/actions";
import { FormMessage, PasswordField, SubmitButton } from "@/components/form";
import type { Dictionary } from "@/i18n/get-dictionary";

export function PasswordForm({ t }: { t: Dictionary["auth"] }) {
  const [state, action] = useActionState(updatePassword, null);
  if (state?.done) return <FormMessage tone="success">{t.resetDone}</FormMessage>;

  return (
    <form action={action} className="flex flex-col gap-5.5">
      {state?.error && <FormMessage tone="error">{t.errors[state.error]}</FormMessage>}
      <PasswordField
        label={t.newPassword}
        showLabel={t.showPassword}
        hideLabel={t.hidePassword}
        autoComplete="new-password"
        minLength={10}
        required
        invalid={state?.fields?.includes("password")}
      >
        <span className="text-[13px] text-ink-muted">{t.passwordRule}</span>
      </PasswordField>
      <SubmitButton>{t.resetButton}</SubmitButton>
    </form>
  );
}
