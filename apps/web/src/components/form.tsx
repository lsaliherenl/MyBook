"use client";

import { useFormStatus } from "react-dom";

export function Field({
  label,
  name,
  type = "text",
  invalid,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; invalid?: boolean; hint?: string }) {
  return (
    <label className="block">
      <span className="eyebrow text-ink-muted">
        {label}
        {hint ? <span className="ml-2 normal-case tracking-normal">({hint})</span> : null}
      </span>
      <input
        name={name}
        type={type}
        aria-invalid={invalid || undefined}
        className="mt-2 block w-full border border-line bg-paper px-4 py-3 text-base outline-none transition-colors focus:border-plum-500 aria-invalid:border-danger"
        {...props}
      />
    </label>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="eyebrow w-full bg-plum-700 px-6 py-4 text-paper transition-colors hover:bg-plum-900 disabled:opacity-60"
    >
      {pending ? "…" : children}
    </button>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`border-l-2 px-4 py-3 text-sm ${tone === "error" ? "border-danger bg-danger/5 text-danger" : "border-success bg-success/5 text-success"}`}
    >
      {children}
    </p>
  );
}
