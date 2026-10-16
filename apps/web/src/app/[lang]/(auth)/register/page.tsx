import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AuthShell } from "../auth-shell";
import { RegisterForm } from "./register-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.registerTitle };
}

export default async function RegisterPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <AuthShell title={t.auth.registerTitle} subtitle={t.auth.registerSubtitle}>
      <RegisterForm locale={locale} t={t.auth} />
    </AuthShell>
  );
}
