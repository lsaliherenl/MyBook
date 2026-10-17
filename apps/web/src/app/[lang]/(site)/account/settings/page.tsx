import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountPageSkeleton } from "@/components/account/page-skeleton";
import type { LoanDto, ProfileDto } from "@mybook/shared";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { api } from "@/lib/api";
import { getMemberCirculation } from "@/lib/member";
import { DataControls, PasswordForm, SettingsForm, SettingsSection } from "./settings-forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).settings.title, robots: { index: false } };
}

export default function SettingsPage(props: PageProps<"/[lang]/account/settings">) {
  return (
    <Suspense fallback={<AccountPageSkeleton />}>
      <SettingsPageContent {...props} />
    </Suspense>
  );
}

async function SettingsPageContent({ searchParams }: PageProps<"/[lang]/account/settings">) {
  const [t, locale, params] = await Promise.all([getDictionary(), getLocale(), searchParams]);
  const [profile, circulation, fines] = await Promise.all([
    api<ProfileDto>("/me", { auth: true }),
    getMemberCirculation(),
    api<{ status: string }[]>("/me/fines", { auth: true }).catch(() => []),
  ]);
  const s = t.settings;
  const loans: LoanDto[] = circulation?.activeLoans ?? [];
  const canClose = loans.length === 0 && (circulation?.openReservations.length ?? 0) === 0 && !fines.some((f) => f.status === "UNPAID");

  return (
    <>
      <div className="flex flex-col gap-3.5">
        <span className="eyebrow text-plum-500">{s.eyebrow}</span>
        <h1 className="m-0 font-serif text-[44px] leading-[.98] font-light md:text-[clamp(52px,5vw,76px)] md:leading-[.96]">{s.title}</h1>
      </div>

      <div className="-mt-4 flex flex-col gap-10">
        <SettingsForm
          profile={profile}
          prefs={profile.notificationPrefs}
          s={s}
          locale={locale}
          faculties={t.auth.faculties}
          languageNames={t.nav.languageNames}
          saved={params.saved === "1"}
          unknownError={t.circulationErrors.unknown}
        />
        <SettingsSection id="h-pass" title={s.password} note={s.passwordNote}>
          <PasswordForm s={s} auth={t.auth} />
        </SettingsSection>
        <SettingsSection id="h-data" title={s.data} note={s.dataNote}>
          <DataControls s={s} locale={locale} canClose={canClose} />
        </SettingsSection>
      </div>
    </>
  );
}
