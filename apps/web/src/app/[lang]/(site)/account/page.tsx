import type { ProfileDto } from "@mybook/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FormMessage } from "@/components/form";
import { format, getDictionary, getLocale } from "@/i18n/get-dictionary";
import { api, ApiError } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).account.title };
}

export default async function AccountPage() {
  const t = await getDictionary();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-8">
      <p className="eyebrow text-ink-muted">{t.account.title}</p>
      <Suspense fallback={<div className="mt-4 h-40 animate-pulse bg-paper-2" />}>
        <AccountDetails />
      </Suspense>
    </div>
  );
}

async function AccountDetails() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  let profile: ProfileDto;
  try {
    profile = await api<ProfileDto>("/me", { auth: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect(`/${locale}/login?next=/${locale}/account`);
    return (
      <div className="mt-6">
        <FormMessage tone="error">{t.account.apiUnavailable}</FormMessage>
      </div>
    );
  }

  const since = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(profile.createdAt));
  const rows: [string, string][] = [
    [t.auth.email, profile.email],
    [t.auth.memberType, t.auth.memberTypes[profile.memberType]],
    ...(profile.studentNumber ? [[t.auth.studentNumber, profile.studentNumber] as [string, string]] : []),
    ...(profile.faculty ? [[t.auth.faculty, profile.faculty] as [string, string]] : []),
    [t.account.role, t.account.roles[profile.role]],
    [t.account.status, t.account.statuses[profile.status]],
    [t.account.memberSince, since],
  ];

  return (
    <>
      <h1 className="mt-3 font-serif text-5xl">{format(t.account.greeting, { name: profile.fullName.split(" ")[0] })}</h1>

      <div className="mt-10 flex items-end justify-between bg-plum-700 p-8 text-paper">
        <div>
          <p className="eyebrow text-paper/70">{t.account.card}</p>
          <p className="mt-3 font-serif text-3xl">{profile.fullName}</p>
        </div>
        <p className="font-mono text-lg tracking-[0.2em]">{profile.cardNumber}</p>
      </div>

      <dl className="mt-10 divide-y divide-line border-y border-line">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-3 gap-4 py-4">
            <dt className="eyebrow pt-0.5 text-ink-muted">{label}</dt>
            <dd className="col-span-2">{value}</dd>
          </div>
        ))}
      </dl>

      <Link href={`/${locale}/account/password`} className="eyebrow mt-8 inline-block text-plum-700 hover:underline">
        {t.account.changePassword} →
      </Link>
    </>
  );
}
