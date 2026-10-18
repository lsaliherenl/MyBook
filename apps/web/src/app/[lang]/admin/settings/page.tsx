import type { Metadata } from "next";
import { Suspense } from "react";
import type { IntegrationDto, LibrarySettingsDto } from "@mybook/shared";
import { AdminSearch } from "@/components/admin/admin-search";
import { AdminTopBar } from "@/components/admin/admin-top-bar";
import { FormMessage } from "@/components/form";
import type { Locale } from "@/i18n/config";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { api } from "@/lib/api";
import { getStaff } from "@/lib/staff";
import { SettingsForm } from "./settings-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.admin.settings.title };
}

/** B20: the circulation rules (admins change them, librarians can read them) and the outside services. */
export default async function SettingsPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div aria-hidden className="m-10 h-96 animate-pulse bg-paper-2" />}>
      <Settings t={t} locale={locale} />
    </Suspense>
  );
}

async function Settings({ t, locale }: { t: Dictionary; locale: Locale }) {
  const s = t.admin.settings;
  const [staff, settings, integrations] = await Promise.all([
    getStaff(),
    api<LibrarySettingsDto>("/admin/settings", { auth: true }).catch(() => null),
    api<IntegrationDto[]>("/admin/integrations", { auth: true }).catch(() => []),
  ]);
  return (
    <>
      <AdminTopBar staff={{ name: staff.fullName, role: t.admin.roles[staff.role] }} languageLabel={t.nav.language}>
        <AdminSearch action={`/${locale}/admin/desk`} label={t.admin.search} placeholder={t.admin.searchPlaceholder} />
      </AdminTopBar>
      <div className="flex flex-col gap-2 border-b border-line px-3.5 pt-7 pb-5 sm:px-10">
        <span className="eyebrow text-[10px] text-plum-500">{s.eyebrow}</span>
        <h1 className="m-0 animate-rise font-serif text-[40px] leading-none font-light sm:text-[48px]">{s.title}</h1>
        <span className="text-[15px] text-ink-muted">{s.subtitle}</span>
      </div>
      {settings ? (
        <SettingsForm settings={settings} integrations={integrations} editable={staff.role === "ADMIN"} locale={locale} text={s} />
      ) : (
        <div className="p-10">
          <FormMessage tone="error">{t.admin.apiUnavailable}</FormMessage>
        </div>
      )}
    </>
  );
}
