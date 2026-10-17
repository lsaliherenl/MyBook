import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { ProfileDto } from "@mybook/shared";
import { signOut } from "@/app/[lang]/(auth)/actions";
import { AccountSideNav, AccountTabs, type AccountNavItem } from "@/components/account/account-nav";
import { FormMessage } from "@/components/form";
import type { Locale } from "@/i18n/config";
import { format, getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { api, ApiError } from "@/lib/api";
import { initials } from "@/lib/format";
import { getMemberCirculation } from "@/lib/member";

/** Every "My account" page (A7–A9): member summary and section menu on the left, the page on the right. */
export default async function AccountLayout({ children }: LayoutProps<"/[lang]/account">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <AccountShell t={t} locale={locale}>
        {children}
      </AccountShell>
    </Suspense>
  );
}

async function AccountShell({ t, locale, children }: { t: Dictionary; locale: Locale; children: React.ReactNode }) {
  let profile: ProfileDto;
  try {
    profile = await api<ProfileDto>("/me", { auth: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect(`/${locale}/login?next=/${locale}/account`);
    return (
      <div className="container-page py-16">
        <FormMessage tone="error">{t.account.apiUnavailable}</FormMessage>
      </div>
    );
  }
  const circulation = await getMemberCirculation();
  const late = circulation?.activeLoans.filter((l) => l.daysOverdue > 0).length ?? 0;
  const a = t.account.nav;
  const base = `/${locale}/account`;
  const items: AccountNavItem[] = [
    { key: "overview", href: base, label: a.overview, short: a.overview },
    { key: "loans", href: `${base}/loans`, label: a.loans, short: a.loansShort, badge: late ? format(a.late, { count: String(late) }) : undefined },
    { key: "history", href: `${base}/history`, label: a.history, short: a.historyShort },
    { key: "lists", href: `${base}/lists`, label: a.lists, short: a.listsShort },
    { key: "settings", href: `${base}/settings`, label: a.settings, short: a.settingsShort },
  ];
  const subtitle = [profile.faculty, profile.studentNumber ?? profile.cardNumber].filter(Boolean).join(" · ");

  return (
    <>
      <AccountTabs label={a.label} items={items} />
      <div className="container-page flex flex-wrap items-start gap-14 pt-7 pb-20 md:pt-12 md:pb-26">
        <aside className="hidden max-w-68 flex-[1_1_240px] flex-col gap-7 md:flex">
          <div className="flex items-center gap-3.5">
            <span className="inline-flex size-13 flex-none items-center justify-center rounded-full bg-plum-700 font-serif text-[22px] font-medium text-paper">
              {initials(profile.fullName)}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-base font-medium">{profile.fullName}</span>
              <span className="truncate text-[13px] text-ink-muted">{subtitle}</span>
            </span>
          </div>
          <AccountSideNav
            label={a.label}
            items={items}
            signOut={
              <form action={signOut} className="mt-2 border-t border-line">
                <input type="hidden" name="lang" value={locale} />
                <button type="submit" className="group flex w-full items-center gap-3.5 px-3 py-3.5 text-left text-[15px] text-ink-muted hover:bg-paper-2 hover:text-ink">
                  <LogOut aria-hidden size={18} strokeWidth={1.5} className="group-hover:animate-icon-tilt" />
                  {a.signOut}
                </button>
              </form>
            }
          />
        </aside>
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-14">{children}</div>
      </div>
    </>
  );
}
