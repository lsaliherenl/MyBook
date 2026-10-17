"use server";

import { passwordSchema, signUpSchema } from "@mybook/shared";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { REMEMBER_COOKIE } from "@/lib/supabase/remember";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "user_already_exists"
  | "weak_password"
  | "invalid_input"
  | "terms_required"
  | "rate_limited"
  | "link_invalid"
  | "unknown";

export type AuthFormState = {
  error?: AuthErrorCode;
  /** Field names that failed validation. */
  fields?: string[];
  done?: boolean;
  /** The address a confirmation or reset link went to, shown back to the user. */
  email?: string;
} | null;

// Root params are not available in Server Actions, so forms send the locale along.
function localeOf(formData: FormData): Locale {
  const value = String(formData.get("lang") ?? "");
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Only same-site paths are allowed as a post-login destination. */
function safeNext(formData: FormData, locale: Locale): string {
  const next = String(formData.get("next") ?? "");
  return next.startsWith(`/${locale}/`) && !next.startsWith("//") ? next : `/${locale}/account`;
}

async function siteOrigin(): Promise<string> {
  const h = await headers();
  return h.get("origin") ?? process.env.SITE_URL ?? "http://localhost:3000";
}

function mapError(code: string | undefined): AuthErrorCode {
  switch (code) {
    case "invalid_credentials":
    case "email_not_confirmed":
    case "user_already_exists":
    case "weak_password":
      return code;
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "rate_limited";
    default:
      return "unknown";
  }
}

const credentialsSchema = z.object({ email: z.email(), password: z.string().min(1) });

export async function signIn(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = localeOf(formData);
  const parsed = credentialsSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "invalid_input", fields: parsed.error.issues.map((i) => String(i.path[0])) };

  const remember = formData.get("remember") === "on";
  const supabase = await createSupabaseServerClient({ remember });
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: mapError(error.code) };
  // Remembered so token refreshes later keep the same cookie lifetime.
  (await cookies()).set(REMEMBER_COOKIE, remember ? "1" : "0", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    ...(remember && { maxAge: 400 * 24 * 60 * 60 }),
  });
  redirect(safeNext(formData, locale));
}

export async function signUp(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = localeOf(formData);
  if (formData.get("terms") !== "on") return { error: "terms_required", fields: ["terms"] };
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    memberType: formData.get("memberType") ?? "STUDENT",
    studentNumber: formData.get("studentNumber") ?? "",
    faculty: formData.get("faculty") || undefined,
    locale,
  });
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => String(i.path[0]));
    return { error: fields.includes("password") ? "weak_password" : "invalid_input", fields };
  }

  const { email, password, fullName, memberType, studentNumber, faculty } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by the database trigger that creates the profile.
      data: { full_name: fullName, member_type: memberType, student_number: studentNumber || null, faculty, locale },
      emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/${locale}/account`,
    },
  });
  if (error) return { error: mapError(error.code) };
  // With e-mail confirmation turned off Supabase signs the user in right away.
  if (data.session) redirect(`/${locale}/account`);
  return { done: true, email };
}

export async function requestPasswordReset(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = localeOf(formData);
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { error: "invalid_input", fields: ["email"] };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/${locale}/account/password`,
  });
  // Same answer whether or not the address has an account, so accounts cannot be probed.
  if (error && mapError(error.code) === "rate_limited") return { error: "rate_limited" };
  return { done: true, email: email.data };
}

export async function updatePassword(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!password.success) return { error: "weak_password", fields: ["password"] };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: mapError(error.code) };
  return { done: true };
}

export async function signOut(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(`/${localeOf(formData)}`);
}
