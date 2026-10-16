"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import type { Dictionary } from "@/i18n/get-dictionary";
import { signIn } from "../actions";

export function LoginForm({ locale, t }: { locale: string; t: Dictionary["auth"] }) {
  const [state, action] = useActionState(signIn, null);
  const params = useSearchParams();
  const linkError = params.get("error") === "link_invalid";
  const error = state?.error ?? (linkError ? "link_invalid" : undefined);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="lang" value={locale} />
      <input type="hidden" name="next" value={params.get("next") ?? ""} />
      {error ? <FormMessage tone="error">{t.errors[error]}</FormMessage> : null}
      <Field label={t.email} name="email" type="email" autoComplete="email" required invalid={state?.fields?.includes("email")} />
      <Field
        label={t.password}
        name="password"
        type="password"
        autoComplete="current-password"
        required
        invalid={state?.fields?.includes("password")}
      />
      <SubmitButton>{t.loginButton} →</SubmitButton>
      <div className="flex justify-between text-sm text-ink-muted">
        <Link href={`/${locale}/forgot-password`} className="underline-offset-4 hover:underline">
          {t.forgotLink}
        </Link>
        <span>
          {t.noAccount}{" "}
          <Link href={`/${locale}/register`} className="text-plum-700 underline-offset-4 hover:underline">
            {t.registerLink}
          </Link>
        </span>
      </div>
    </form>
  );
}
