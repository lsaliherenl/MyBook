"use client";

import { BookOpen, Heart, History, LayoutGrid, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface AccountNavItem {
  key: "overview" | "loans" | "history" | "lists" | "settings";
  href: string;
  label: string;
  short: string;
  badge?: string;
}

/** Each icon moves its own way on hover (design: spin / beat / pop). */
const ICONS: Record<AccountNavItem["key"], { icon: LucideIcon; hover: string }> = {
  overview: { icon: LayoutGrid, hover: "group-hover:animate-icon-pop" },
  loans: { icon: BookOpen, hover: "group-hover:animate-icon-pop" },
  history: { icon: History, hover: "group-hover:animate-icon-spin" },
  lists: { icon: Heart, hover: "group-hover:animate-icon-beat" },
  settings: { icon: UserRound, hover: "group-hover:animate-icon-pop" },
};

function isCurrent(pathname: string, item: AccountNavItem) {
  return item.key === "overview" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Sidebar on desktop: icon, label, a red "1 late" badge on loans; sign out at the bottom. */
export function AccountSideNav({ label, items, signOut }: { label: string; items: AccountNavItem[]; signOut: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex flex-col border-t border-line">
      {items.map((item) => {
        const { icon: Icon, hover } = ICONS[item.key];
        const current = isCurrent(pathname, item);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`group flex items-center gap-3.5 py-3.5 pr-3 text-[15px] text-ink no-underline hover:bg-paper-2 ${
              current ? "border-l-3 border-plum-700 bg-paper-2 pl-2.25 font-medium" : "pl-3"
            }`}
          >
            <Icon aria-hidden size={18} strokeWidth={1.5} className={`flex-none ${hover}`} />
            <span className="min-w-0 flex-1 leading-[1.3]">{item.label}</span>
            {item.badge && <span className="bg-overdue-bg px-1.75 py-0.5 text-xs whitespace-nowrap text-overdue">{item.badge}</span>}
          </Link>
        );
      })}
      {signOut}
    </nav>
  );
}

/** Phone: the same sections as a horizontally scrolling tab row under the header. */
export function AccountTabs({ label, items }: { label: string; items: AccountNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex gap-6 overflow-x-auto border-b border-line px-5 whitespace-nowrap [scrollbar-width:none] md:hidden">
      {items.map((item) => {
        const current = isCurrent(pathname, item);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`border-b-2 pt-3.5 pb-3 text-[15px] no-underline ${current ? "border-plum-700 font-medium text-ink" : "border-transparent text-ink-muted"}`}
          >
            {item.short}
            {item.badge && <span aria-hidden className="ml-1.5 inline-block size-1.5 rounded-full bg-overdue align-middle" />}
          </Link>
        );
      })}
    </nav>
  );
}
