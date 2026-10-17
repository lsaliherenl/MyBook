"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { MEMBER_TYPES } from "@mybook/shared";
import { Checkbox, Field, FormMessage, PasswordField, SelectField, SubmitButton } from "@/components/form";
import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import { signUp } from "../actions";

/** 0–4: long enough, has a digit, has letters, and either mixed case/symbols or 14+ characters. */
function strength(password: string): number {
  if (!password) return 0;
  return [
    password.length >= 10,
    /[0-9]/.test(password),
    /\p{L}/u.test(password),
    (/\p{Lu}/u.test(password) && /\p{Ll}/u.test(password)) || /[^\p{L}0-9]/u.test(password) || password.length >= 14,
  ].filter(Boolean).length;
}

export function RegisterForm({ locale, t }: { locale: string; t: Dictionary["auth"] }) {
  const [state, action] = useActionState(signUp, null);
  const [password, setPassword] = useState("");
  const [memberType, setMemberType] = useState<(typeof MEMBER_TYPES)[number]>("STUDENT");
  const invalid = (field: string) => state?.fields?.includes(field);

  if (state?.done) {
    return (
      <div role="status" className="flex animate-swap flex-col gap-5">
        <span className="inline-flex size-14 items-center justify-center rounded-full border border-plum-700 text-plum-700">
          <Mail aria-hidden size={24} strokeWidth={1.5} />
        </span>
        <h2 className="m-0 font-serif text-[44px] leading-none font-light md:text-[52px]">{t.checkEmailTitle}</h2>
        <p className="m-0 text-base leading-relaxed text-ink-muted">
          {format(t.checkEmail, { email: state.email ?? "" })}
        </p>
        <Link href={`/${locale}/login`} className="eyebrow inline-flex h-13 items-center self-start bg-plum-700 px-6 text-xs text-paper no-underline hover:bg-plum-900">
          {t.back}
        </Link>
      </div>
    );
  }

  const score = strength(password);
  const tone = score <= 1 ? "bg-overdue" : score === 2 ? "bg-gold" : "bg-available";
  const toneText = score <= 1 ? "text-overdue" : score === 2 ? "text-ready" : "text-available";

  return (
    <form action={action} className="flex animate-swap flex-col gap-5">
      <input type="hidden" name="lang" value={locale} />
      <input type="hidden" name="memberType" value={memberType} />
      {state?.error && <FormMessage tone="error">{t.errors[state.error]}</FormMessage>}

      <Field label={t.fullName} name="fullName" autoComplete="name" required minLength={2} invalid={invalid("fullName")} />
      <Field label={t.email} name="email" type="email" autoComplete="email" required hint={t.emailHint} invalid={invalid("email")} />

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 text-sm font-medium">{t.memberType}</legend>
        <div className="grid grid-cols-3 border border-line">
          {MEMBER_TYPES.map((type) => (
            <label
              key={type}
              className={`flex h-11 cursor-pointer items-center justify-center text-sm has-focus-visible:outline-2 has-focus-visible:outline-plum-500 ${
                memberType === type ? "bg-ink text-paper" : "bg-paper-3 hover:bg-paper-2"
              }`}
            >
              <input type="radio" name="memberTypeChoice" value={type} checked={memberType === type} onChange={() => setMemberType(type)} className="sr-only" />
              {t.memberTypes[type]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t.studentNumber} name="studentNumber" inputMode="numeric" pattern="[0-9]{6,12}" invalid={invalid("studentNumber")} />
        <SelectField label={t.faculty} name="faculty" options={t.faculties} />
      </div>

      <PasswordField
        label={t.password}
        showLabel={t.showPassword}
        hideLabel={t.hidePassword}
        autoComplete="new-password"
        required
        minLength={10}
        invalid={invalid("password")}
        onValue={setPassword}
        aria-describedby="password-help"
      >
        <div aria-hidden className="mt-0.5 grid grid-cols-4 gap-1">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={`h-0.75 transition-colors duration-300 ${i <= score ? tone : "bg-line"}`} />
          ))}
        </div>
        <span id="password-help" className="text-[13px] text-ink-muted">
          {password && <span className={toneText}>{t.strength[Math.max(0, score - 1)]} · </span>}
          {t.passwordRule}
        </span>
      </PasswordField>

      <Checkbox name="terms" required>
        {t.acceptPrefix}
        <Link href={`/${locale}/about#rules`} className="text-plum-700 underline underline-offset-3">
          {t.acceptRules}
        </Link>
        {t.acceptAnd}
        <Link href={`/${locale}/about#privacy`} className="text-plum-700 underline underline-offset-3">
          {t.acceptPrivacy}
        </Link>
        {t.acceptSuffix}
      </Checkbox>

      <SubmitButton>{t.registerButton}</SubmitButton>
    </form>
  );
}
