"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Checkbox, Field, FormMessage, PasswordField, SubmitButton } from "@/components/form";
import type { Dictionary } from "@/i18n/get-dictionary";
import { signIn } from "../actions";

export function LoginForm({ locale, t }: { locale: string; t: Dictionary["auth"] }) {
  const [state, action] = useActionState(signIn, null);
  const params = useSearchParams();
  const error = state?.error ?? (params.get("error") === "link_invalid" ? "link_invalid" : undefined);

  return (
    <form action={action} className="flex animate-swap flex-col gap-5.5">
      <input type="hidden" name="lang" value={locale} />
      <input type="hidden" name="next" value={params.get("next") ?? ""} />
      {error && <FormMessage tone="error">{t.errors[error]}</FormMessage>}
      <Field label={t.email} name="email" type="email" autoComplete="username" required invalid={state?.fields?.includes("email")} />
      <PasswordField
        label={t.password}
        showLabel={t.showPassword}
        hideLabel={t.hidePassword}
        autoComplete="current-password"
        required
        invalid={state?.fields?.includes("password")}
        aside={
          <Link href={`/${locale}/forgot-password`} className="text-sm text-ink underline underline-offset-4 hover:text-plum-500">
            {t.forgotLink}
          </Link>
        }
      />
      <Checkbox name="remember" defaultChecked>
        <span className="text-[15px]">{t.rememberMe}</span>
      </Checkbox>
      <SubmitButton>
        {t.loginButton}
        <ArrowRight aria-hidden size={16} strokeWidth={1.5} />
      </SubmitButton>
    </form>
  );
}
