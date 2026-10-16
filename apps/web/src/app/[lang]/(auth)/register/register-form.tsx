"use client";

import { MEMBER_TYPES } from "@mybook/shared";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import type { Dictionary } from "@/i18n/get-dictionary";
import { signUp } from "../actions";

export function RegisterForm({ locale, t }: { locale: string; t: Dictionary["auth"] }) {
  const [state, action] = useActionState(signUp, null);
  const [memberType, setMemberType] = useState<(typeof MEMBER_TYPES)[number]>("STUDENT");
  const invalid = (field: string) => state?.fields?.includes(field);

  if (state?.done) return <FormMessage tone="success">{t.checkEmail}</FormMessage>;

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="lang" value={locale} />
      {state?.error ? <FormMessage tone="error">{t.errors[state.error]}</FormMessage> : null}
      <Field label={t.fullName} name="fullName" autoComplete="name" required invalid={invalid("fullName")} />
      <Field label={t.email} name="email" type="email" autoComplete="email" required invalid={invalid("email")} />
      <Field
        label={t.password}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        invalid={invalid("password")}
      />

      <fieldset>
        <legend className="eyebrow text-ink-muted">{t.memberType}</legend>
        <div className="mt-2 grid grid-cols-3 border border-line">
          {MEMBER_TYPES.map((type) => (
            <label
              key={type}
              className="cursor-pointer px-3 py-3 text-center text-sm has-checked:bg-plum-700 has-checked:text-paper [&:not(:first-child)]:border-l [&:not(:first-child)]:border-line"
            >
              <input
                type="radio"
                name="memberType"
                value={type}
                checked={memberType === type}
                onChange={() => setMemberType(type)}
                className="sr-only"
              />
              {t.memberTypes[type]}
            </label>
          ))}
        </div>
      </fieldset>

      {memberType === "STUDENT" ? (
        <Field
          label={t.studentNumber}
          name="studentNumber"
          inputMode="numeric"
          pattern="[0-9]{6,12}"
          invalid={invalid("studentNumber")}
        />
      ) : null}
      <Field label={t.faculty} name="faculty" hint={t.optional} invalid={invalid("faculty")} />

      <SubmitButton>{t.registerButton} →</SubmitButton>
      <p className="text-sm text-ink-muted">
        {t.haveAccount}{" "}
        <Link href={`/${locale}/login`} className="text-plum-700 underline-offset-4 hover:underline">
          {t.loginLink}
        </Link>
      </p>
    </form>
  );
}
