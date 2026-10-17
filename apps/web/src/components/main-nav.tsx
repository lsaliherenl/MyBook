"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

/** Header links; the section you are in is marked for screen readers and gets a plum underline. */
export function MainNav({ label, links }: { label: string; links: { href: string; label: string }[] }) {
  return <NavLinks label={label} links={links} pathname={usePathname()} />;
}

/** The same links without the current-section mark, shown while a dynamic page streams in. */
export function NavLinks({ label, links, pathname = "" }: { label: string; links: { href: string; label: string }[]; pathname?: string }) {
  return (
    <nav aria-label={label} className="hidden flex-wrap gap-x-11 gap-y-2 text-[15px] lg:flex">
      {links.map((link) => {
        const current = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? "page" : undefined}
            className={`no-underline decoration-plum-500 underline-offset-8 hover:text-plum-500 ${current ? "text-ink underline" : "text-ink"}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Phone menu (design: a small panel under the ☰ button). Closes after navigating. */
export function MobileMenu({ label, openLabel, children }: { label: string; openLabel: string; children: React.ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={menu}
      className="menu group/menu relative lg:hidden"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, nav > button") && menu.current) menu.current.open = false;
      }}
    >
      <summary aria-label={openLabel} className="inline-flex size-11 cursor-pointer items-center justify-center text-ink group-open/menu:bg-paper-2">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
      </summary>
      <nav
        aria-label={label}
        className="absolute top-[calc(100%+8px)] right-0 z-60 flex w-62 animate-drop flex-col border border-line bg-paper-3 py-3 shadow-[0_24px_48px_-20px_rgba(35,26,31,.45)] [&>a]:px-5.5 [&>a]:py-2.75 [&>a]:text-base [&>a]:text-ink [&>a]:no-underline [&>a:hover]:bg-paper-2 [&>button]:px-5.5 [&>button]:py-2.75 [&>button]:text-left [&>button]:text-base [&>button:hover]:bg-paper-2"
      >
        {children}
      </nav>
    </details>
  );
}
