"use client";

import { Check, ChevronDown, Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import { useFormStatus } from "react-dom";

const inputClass =
  "h-13 w-full min-w-0 rounded-xs border border-line bg-paper-3 px-4 text-base text-ink outline-none focus:border-plum-500 aria-invalid:border-overdue";

/** Label above, input below, optional hint under it (design: 14px medium label, 52px paper-3 input). */
export function Field({
  label,
  name,
  type = "text",
  invalid,
  hint,
  aside,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; invalid?: boolean; hint?: string; aside?: React.ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {aside}
      </span>
      <input id={id} name={name} type={type} aria-invalid={invalid || undefined} aria-describedby={hint ? `${id}-hint` : undefined} className={inputClass} {...props} />
      {hint && (
        <span id={`${id}-hint`} className="text-[13px] text-ink-muted">
          {hint}
        </span>
      )}
    </div>
  );
}

/** Password input with a show/hide eye button. */
export function PasswordField({
  label,
  showLabel,
  hideLabel,
  invalid,
  aside,
  children,
  onValue,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  showLabel: string;
  hideLabel: string;
  invalid?: boolean;
  aside?: React.ReactNode;
  onValue?: (value: string) => void;
  children?: React.ReactNode;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {aside}
      </span>
      <div className="relative">
        <input
          id={id}
          name="password"
          type={visible ? "text" : "password"}
          aria-invalid={invalid || undefined}
          onChange={(e) => onValue?.(e.target.value)}
          className={`${inputClass} pr-13`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          className="absolute top-1 right-1 inline-flex size-11 items-center justify-center text-ink-muted hover:text-plum-500"
        >
          {visible ? <EyeOff aria-hidden size={20} strokeWidth={1.5} /> : <Eye aria-hidden size={20} strokeWidth={1.5} />}
        </button>
      </div>
      {children}
    </div>
  );
}

export function SelectField({ label, name, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string; options: string[] }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <select id={id} name={name} className={`${inputClass} appearance-none pr-10 text-[15px]`} {...props}>
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <ChevronDown aria-hidden size={16} strokeWidth={1.5} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2" />
      </div>
    </div>
  );
}

/** Square plum checkbox from the design system. */
export function Checkbox({ name, children, defaultChecked, required }: { name: string; children: React.ReactNode; defaultChecked?: boolean; required?: boolean }) {
  return (
    <label className="group flex cursor-pointer items-start gap-3 text-sm leading-normal">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} required={required} className="peer sr-only" />
      <span
        aria-hidden
        className="mt-px inline-flex size-5 flex-none items-center justify-center rounded-xs border border-ink-muted text-transparent peer-checked:border-plum-700 peer-checked:bg-plum-700 peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-plum-500"
      >
        <Check size={14} strokeWidth={2} />
      </span>
      <span>{children}</span>
    </label>
  );
}

export function SubmitButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`eyebrow inline-flex h-14 w-full items-center justify-center gap-3 bg-plum-700 px-6 text-xs text-paper hover:bg-plum-900 disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`m-0 animate-swap border-l-2 px-4 py-3 text-sm ${tone === "error" ? "border-overdue bg-overdue-bg text-overdue" : "border-available bg-available-bg text-available"}`}
    >
      {children}
    </p>
  );
}
