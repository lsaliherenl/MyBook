import { getDictionary } from "@/i18n/get-dictionary";
import { AuthShell } from "../../(auth)/auth-shell";
import { PasswordForm } from "./password-form";

export default async function PasswordPage() {
  const t = await getDictionary();
  return (
    <AuthShell title={t.auth.resetTitle} subtitle="">
      <PasswordForm t={t.auth} />
    </AuthShell>
  );
}
