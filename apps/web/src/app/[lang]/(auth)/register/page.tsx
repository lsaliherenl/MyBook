import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AuthHeading, AuthTabs } from "../auth-tabs";
import { RegisterForm } from "./register-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.registerTitle };
}

export default async function RegisterPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <>
      <AuthTabs current="register" locale={locale} t={t.auth} />
      <AuthHeading eyebrow={t.auth.registerEyebrow} title={t.auth.registerTitle} />
      <RegisterForm locale={locale} t={t.auth} />
    </>
  );
}
