"use client";

import { ChevronLeft, Mail } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import { requestPasswordReset } from "../actions";

const RESEND_AFTER = 45;

export function ForgotPasswordForm({ locale, t }: { locale: string; t: Dictionary["auth"] }) {
  const [state, action] = useActionState(requestPasswordReset, null);
  const back = (
    <Link href={`/${locale}/login`} className="inline-flex h-10 items-center gap-2 self-start text-sm text-ink-muted no-underline hover:text-plum-500">
      <ChevronLeft aria-hidden size={16} strokeWidth={1.5} />
      {t.back}
    </Link>
  );

  if (state?.done) return <Sent locale={locale} t={t} email={state.email ?? ""} action={action} />;

  return (
    <form action={action} className="flex animate-swap flex-col gap-5.5">
      {back}
      <div className="flex flex-col gap-3">
        <span className="eyebrow text-plum-500">{t.forgotEyebrow}</span>
        <h1 className="m-0 font-serif text-[44px] leading-[.98] font-light md:text-[56px]">{t.forgotTitle}</h1>
        <p className="m-0 text-base leading-relaxed text-ink-muted">{t.forgotText}</p>
      </div>
      <input type="hidden" name="lang" value={locale} />
      {state?.error && <FormMessage tone="error">{t.errors[state.error]}</FormMessage>}
      <Field label={t.email} name="email" type="email" autoComplete="email" required invalid={state?.fields?.includes("email")} />
      <SubmitButton>{t.forgotButton}</SubmitButton>
    </form>
  );
}

/** "Check your inbox", with a resend button that unlocks after 45 seconds. */
function Sent({ locale, t, email, action }: { locale: string; t: Dictionary["auth"]; email: string; action: (formData: FormData) => void }) {
  const [left, setLeft] = useState(RESEND_AFTER);
  const timer = useRef<number>(undefined);
  useEffect(() => {
    timer.current = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer.current);
  }, []);

  return (
    <div role="status" className="flex animate-swap flex-col gap-5">
      <span className="inline-flex size-14 items-center justify-center rounded-full border border-plum-700 text-plum-700">
        <Mail aria-hidden size={24} strokeWidth={1.5} />
      </span>
      <h1 className="m-0 font-serif text-[44px] leading-none font-light md:text-[52px]">{t.checkEmailTitle}</h1>
      <p className="m-0 text-base leading-relaxed text-ink-muted">{format(t.forgotSent, { email })}</p>
      <div className="flex flex-wrap gap-3">
        <Link href={`/${locale}/login`} className="eyebrow inline-flex h-13 items-center bg-plum-700 px-6 text-xs text-paper no-underline hover:bg-plum-900">
          {t.back}
        </Link>
        <form action={action}>
          <input type="hidden" name="lang" value={locale} />
          <input type="hidden" name="email" value={email} />
          <button
            type="submit"
            disabled={left > 0}
            className="eyebrow h-13 border border-ink px-5 text-xs text-ink tabular-nums enabled:hover:bg-ink enabled:hover:text-paper disabled:border-line disabled:text-ink-muted"
          >
            {left > 0 ? format(t.resendIn, { time: `0:${String(left).padStart(2, "0")}` }) : t.resend}
          </button>
        </form>
      </div>
    </div>
  );
}
