import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { PasswordForm } from "./password-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.resetTitle, robots: { index: false } };
}

/** Choosing a new password — also where the reset e-mail link lands after signing the member in. */
export default async function PasswordPage() {
  const t = await getDictionary();
  return (
    <div className="flex max-w-110 flex-col gap-7">
      <h1 className="m-0 font-serif text-[44px] leading-none font-light md:text-[56px]">{t.auth.resetTitle}</h1>
      <PasswordForm t={t.auth} />
    </div>
  );
}
