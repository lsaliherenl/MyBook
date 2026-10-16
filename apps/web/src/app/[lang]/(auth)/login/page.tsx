import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AuthShell } from "../auth-shell";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.loginButton };
}

export default async function LoginPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <AuthShell title={t.auth.loginTitle} subtitle={t.auth.loginSubtitle}>
      <Suspense>
        <LoginForm locale={locale} t={t.auth} />
      </Suspense>
    </AuthShell>
  );
}
