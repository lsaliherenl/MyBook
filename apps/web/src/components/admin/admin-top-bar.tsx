import { Suspense } from "react";
import { initials } from "@/lib/format";
import { LanguageLinks, LanguageSwitch } from "../language-switch";

export interface TopBarStaff {
  name: string;
  role: string;
}

/**
 * The bar above every librarian page: the page's own tools on the left (search, desk mode),
 * an optional status and who is at the desk on the right. Plain props so client pages can use it too.
 */
export function AdminTopBar({
  staff,
  languageLabel,
  status,
  children,
}: {
  staff: TopBarStaff;
  languageLabel: string;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  const switchClass = "inline-flex border-l border-line pl-2.5";
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-line px-3.5 py-4.5 sm:px-10 print:hidden">
      {children}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {status}
        <span className="flex items-center gap-3">
          <span aria-hidden className="inline-flex size-8.5 flex-none items-center justify-center rounded-full bg-ink font-serif text-[15px] text-paper">
            {initials(staff.name)}
          </span>
          <span className="flex flex-col">
            <span className="text-[15px] leading-tight">{staff.name}</span>
            <span className="text-xs text-ink-muted">{staff.role}</span>
          </span>
        </span>
        <Suspense fallback={<LanguageLinks label={languageLabel} className={switchClass} />}>
          <LanguageSwitch label={languageLabel} className={switchClass} />
        </Suspense>
      </div>
    </div>
  );
}
