"use client";

import { Search } from "lucide-react";
import Form from "next/form";
import { useEffect, useRef } from "react";

/**
 * Top-bar search: a member (card, pickup code, name…) or a copy barcode opens at the desk.
 * "/" anywhere on the page jumps here, as in the design.
 */
export function AdminSearch({ action, label, placeholder }: { action: string; label: string; placeholder: string }) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key !== "/" || target.closest("input, textarea, select, [contenteditable]")) return;
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Form
      action={action}
      role="search"
      className="flex h-11 max-w-130 flex-[1_1_320px] items-center gap-3 rounded-xs border border-line bg-paper-3 px-3.5 focus-within:border-plum-500"
    >
      <Search aria-hidden size={18} strokeWidth={1.5} className="flex-none text-ink-muted" />
      <label htmlFor="admin-q" className="sr-only">
        {label}
      </label>
      <input
        ref={input}
        id="admin-q"
        name="q"
        type="search"
        required
        minLength={2}
        autoComplete="off"
        placeholder={placeholder}
        className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted"
      />
      <kbd aria-hidden className="border border-line px-1.5 py-px font-sans text-xs text-ink-muted">
        /
      </kbd>
    </Form>
  );
}
