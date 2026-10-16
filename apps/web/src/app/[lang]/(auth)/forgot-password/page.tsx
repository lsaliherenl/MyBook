import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AuthShell } from "../auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export default async function ForgotPasswordPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <AuthShell title={t.auth.forgotTitle} subtitle={t.auth.forgotSubtitle}>
      <ForgotPasswordForm locale={locale} t={t.auth} />
    </AuthShell>
  );
}
