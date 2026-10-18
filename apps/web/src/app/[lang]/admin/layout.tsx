import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import type { DeskTodayDto } from "@mybook/shared";
import { AdminNav, AdminNavLinks, type AdminNavItem } from "@/components/admin/admin-nav";
import { FormMessage } from "@/components/form";
import { TodaysHours } from "@/components/todays-hours";
import type { Locale } from "@/i18n/config";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { api, ApiError } from "@/lib/api";
import { getStaff, isStaff } from "@/lib/staff";

export const metadata: Metadata = { robots: { index: false } };

/** Librarian screens (B13–B20): the section column on the left, each page with its own top bar. */
export default async function AdminLayout({ children }: LayoutProps<"/[lang]/admin">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <StaffOnly t={t} locale={locale}>
        <AdminShell t={t} locale={locale}>
          {children}
        </AdminShell>
      </StaffOnly>
    </Suspense>
  );
}

function AdminShell({ t, locale, children }: { t: Dictionary; locale: Locale; children: React.ReactNode }) {
  const items = navItems(t, locale);
  return (
    <div className="flex min-h-[max(900px,100vh)] flex-1 flex-wrap bg-paper text-ink">
      <aside className="sticky top-0 z-20 flex flex-[1_1_100%] flex-row items-center gap-0.5 overflow-x-auto border-b border-line bg-[#f3ece2] px-2.5 py-1.5 [scrollbar-width:none] min-[900px]:z-5 min-[900px]:h-screen min-[900px]:max-w-62 min-[900px]:flex-[0_0_248px] min-[900px]:flex-col min-[900px]:items-stretch min-[900px]:self-start min-[900px]:overflow-y-auto min-[900px]:border-r min-[900px]:border-b-0 min-[900px]:px-0 min-[900px]:py-6 print:hidden">
        <Link href={`/${locale}/admin`} className="flex flex-none flex-col gap-1.25 pr-3.5 pl-1.5 text-ink no-underline min-[900px]:px-6 min-[900px]:pb-7">
          <span className="font-serif text-base tracking-[.2em] whitespace-nowrap min-[900px]:text-[21px] min-[900px]:tracking-[.26em]">{t.brand.name}</span>
          <span className="eyebrow hidden text-[9px] tracking-[.3em] text-plum-500 min-[900px]:block">{t.admin.brandSub}</span>
        </Link>
        <Suspense fallback={<AdminNavLinks label={t.admin.navLabel} items={items} soon={t.admin.soon} />}>
          <NavWithBadge t={t} items={items} />
        </Suspense>
        <div className="mt-auto hidden flex-col gap-1 px-6 pt-6 text-[13px] text-ink-muted min-[900px]:flex">
          <TodaysHours openUntil={t.admin.deskOpenUntil} closedToday={t.admin.deskClosedToday} weekdays="21:45" saturday="17:45" />
          <Link href={`/${locale}`} className="text-ink-muted hover:text-ink">
            {t.admin.viewSite}
          </Link>
        </div>
      </aside>
      <div className="flex min-w-0 flex-[999_1_640px] flex-col">{children}</div>
    </div>
  );
}

function navItems(t: Dictionary, locale: Locale): AdminNavItem[] {
  const n = t.admin.nav;
  const base = `/${locale}/admin`;
  return [
    { key: "dashboard", label: n.dashboard, href: base },
    { key: "desk", label: n.desk, href: `${base}/desk` },
    { key: "books", label: n.books, href: `${base}/books` },
    { key: "import", label: n.import, href: `${base}/import` },
    { key: "members", label: n.members, href: `${base}/members` },
    { key: "events", label: n.events },
    { key: "reports", label: n.reports },
    { key: "settings", label: n.settings },
  ];
}

/** The desk entry shows how many pickup codes are waiting on the hold shelf. */
async function NavWithBadge({ t, items }: { t: Dictionary; items: AdminNavItem[] }) {
  let waiting = 0;
  try {
    const today = await api<DeskTodayDto>("/admin/desk/today", { auth: true });
    waiting = today.pickups.filter((p) => p.status === "READY").length;
  } catch {
    // The API is down: the page says so; the menu just shows no count.
  }
  const withBadge = items.map((item) => (item.key === "desk" && waiting ? { ...item, badge: String(waiting) } : item));
  return <AdminNav label={t.admin.navLabel} items={withBadge} soon={t.admin.soon} />;
}

async function StaffOnly({ t, locale, children }: { t: Dictionary; locale: Locale; children: React.ReactNode }) {
  try {
    const staff = await getStaff();
    // Members never learn that the librarian screens exist.
    if (!isStaff(staff)) notFound();
  } catch (error) {
    // notFound() and redirect() work by throwing; let them through.
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === 401) redirect(`/${locale}/login?next=/${locale}/admin`);
    // Any other failure, including the API not being reachable at all, gets the message instead of the 500 page.
    return (
      <div className="p-10">
        <FormMessage tone="error">{t.admin.apiUnavailable}</FormMessage>
      </div>
    );
  }
  return children;
}
