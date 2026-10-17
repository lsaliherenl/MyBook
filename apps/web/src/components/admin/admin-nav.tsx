"use client";

import {
  BookOpen,
  CalendarDays,
  ChartLine,
  Download,
  LayoutDashboard,
  ScanBarcode,
  SlidersVertical,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminNavKey = "dashboard" | "desk" | "books" | "import" | "members" | "events" | "reports" | "settings";

export interface AdminNavItem {
  key: AdminNavKey;
  label: string;
  /** Missing for screens that are not built yet; they show as "Soon". */
  href?: string;
  badge?: string;
}

const ICONS: Record<AdminNavKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  desk: ScanBarcode,
  books: BookOpen,
  import: Download,
  members: Users,
  events: CalendarDays,
  reports: ChartLine,
  settings: SlidersVertical,
};

/**
 * Librarian sections: a sticky column on desktop, a horizontally scrolling bar under 900px.
 * The current section gets the plum rule (left on desktop, underline on the bar).
 */
export function AdminNav({ label, items, soon }: { label: string; items: AdminNavItem[]; soon: string }) {
  const pathname = usePathname();
  return <AdminNavLinks label={label} items={items} soon={soon} pathname={pathname} />;
}

/** Static version for the Suspense fallback (no current page yet). */
export function AdminNavLinks({ label, items, soon, pathname }: { label: string; items: AdminNavItem[]; soon: string; pathname?: string }) {
  return (
    <nav aria-label={label} className="flex flex-none flex-row gap-0.5 min-[900px]:flex-col">
      {items.map((item) => {
        const Icon = ICONS[item.key];
        const base =
          "group flex items-center gap-2 px-3 py-2.5 text-sm whitespace-nowrap no-underline border-b-2 min-[900px]:gap-3.5 min-[900px]:border-b-0 min-[900px]:border-l-3 min-[900px]:py-3 min-[900px]:pr-6 min-[900px]:pl-5.25 min-[900px]:text-[15px]";
        if (!item.href) {
          return (
            <span key={item.key} aria-disabled="true" className={`${base} border-transparent text-ink-muted/70`}>
              <Icon aria-hidden size={20} strokeWidth={1.5} className="flex-none" />
              <span className="flex-1">{item.label}</span>
              <span className="eyebrow hidden text-[8.5px] min-[900px]:inline">{soon}</span>
            </span>
          );
        }
        const current = pathname !== undefined && (item.key === "dashboard" ? pathname === item.href : pathname.startsWith(item.href));
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`${base} text-ink ${current ? "border-plum-700 font-medium min-[900px]:bg-paper-2" : "border-transparent hover:bg-paper-2"}`}
          >
            <Icon aria-hidden size={20} strokeWidth={1.5} className="flex-none group-hover:animate-icon-pop" />
            <span className="flex-1">{item.label}</span>
            {item.badge && <span className="bg-ready-bg px-1.75 py-px text-xs font-normal text-ready">{item.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
