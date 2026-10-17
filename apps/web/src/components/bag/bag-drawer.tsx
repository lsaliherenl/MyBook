"use client";

import { X } from "lucide-react";
import { createContext, use, useEffect, useRef, useState } from "react";

const BagContext = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({ open: false, setOpen: () => {} });

export function useBagDrawer() {
  return use(BagContext);
}

export function BagProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <BagContext value={{ open, setOpen }}>{children}</BagContext>;
}

/** The header's bag icon with its count badge. */
export function BagButton({ count, label, size = 22 }: { count: number; label: string; size?: number }) {
  const { setOpen } = useBagDrawer();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={label}
      aria-haspopup="dialog"
      className="relative inline-flex size-11 items-center justify-center text-ink hover:text-plum-500"
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      {count > 0 && (
        <span className="absolute top-1.5 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-plum-700 px-1 text-[10px] font-medium text-paper sm:top-1.25 sm:right-0.75 sm:h-4.25 sm:min-w-4.25">
          {count}
        </span>
      )}
    </button>
  );
}

/** Opens the drawer from anywhere else, e.g. the mobile menu's "Borrow bag" entry. */
export function OpenBagButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { setOpen } = useBagDrawer();
  return (
    <button type="button" onClick={() => setOpen(true)} className={className}>
      {children}
    </button>
  );
}

export function CloseBagButton({ children, className, label }: { children?: React.ReactNode; className?: string; label?: string }) {
  const { setOpen } = useBagDrawer();
  return (
    <button type="button" onClick={() => setOpen(false)} className={className} aria-label={label}>
      {children ?? <X aria-hidden size={22} strokeWidth={1.5} />}
    </button>
  );
}

/** Right-hand drawer (design: "sağdan açılan ödünç çantası çekmecesi"). Its contents are rendered on the server. */
export function BagDrawer({ labelledBy, children }: { labelledBy: string; children: React.ReactNode }) {
  const { open, setOpen } = useBagDrawer();
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
      previous?.focus();
    };
  }, [open, setOpen]);

  return (
    <>
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-90 cursor-pointer bg-plum-900/50 transition-[opacity,visibility] duration-350 ${open ? "visible opacity-100" : "invisible opacity-0"}`}
      />
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        inert={!open}
        // Following a link inside the drawer (a book, "Browse the catalog") closes it.
        onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
        className={`fixed inset-y-0 right-0 z-91 flex w-[min(440px,100%)] flex-col bg-paper text-ink shadow-drawer outline-none transition-[translate,visibility] duration-500 ease-out-soft ${open ? "visible translate-x-0" : "invisible translate-x-[104%]"}`}
      >
        {children}
      </aside>
    </>
  );
}
