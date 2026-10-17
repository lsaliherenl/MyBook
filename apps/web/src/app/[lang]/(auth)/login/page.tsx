import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AuthHeading, AuthTabs } from "../auth-tabs";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.loginTitle };
}

export default async function LoginPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <>
      <AuthTabs current="login" locale={locale} t={t.auth} />
      <AuthHeading eyebrow={t.auth.loginEyebrow} title={t.auth.loginTitle} />
      <Suspense>
        <LoginForm locale={locale} t={t.auth} />
      </Suspense>
    </>
  );
}
