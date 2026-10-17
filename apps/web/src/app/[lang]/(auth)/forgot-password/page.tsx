import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { ForgotPasswordForm } from "./forgot-password-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.forgotTitle };
}

export default async function ForgotPasswordPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return <ForgotPasswordForm locale={locale} t={t.auth} />;
}
