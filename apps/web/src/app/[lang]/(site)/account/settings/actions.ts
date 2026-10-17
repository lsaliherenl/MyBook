"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { NOTIFICATION_KINDS, passwordSchema, type NotificationPrefs, type ProfileDto } from "@mybook/shared";
import { isLocale } from "@/i18n/config";
import { api, ApiError } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SettingsState = { error: string | null; done?: boolean };

/** "Save changes": phone, faculty, language and notification switches. */
export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const faculty = String(formData.get("faculty") ?? "").trim();
  const locale = String(formData.get("locale"));
  const notificationPrefs = Object.fromEntries(
    NOTIFICATION_KINDS.map((kind) => [kind, { email: formData.get(`${kind}.email`) === "on", push: formData.get(`${kind}.push`) === "on" }]),
  ) as NotificationPrefs;

  let profile: ProfileDto;
  try {
    profile = await api<ProfileDto>("/me", {
      method: "PATCH",
      auth: true,
      body: JSON.stringify({ phone: phone || null, faculty: faculty || null, notificationPrefs, ...(isLocale(locale) && { locale }) }),
    });
  } catch (error) {
    return { error: error instanceof ApiError && error.status === 400 ? "invalid_phone" : "unknown" };
  }
  // A new language takes the member to the same page in that language.
  if (formData.get("currentLocale") !== profile.locale) redirect(`/${profile.locale}/account/settings?saved=1`);
  refresh();
  return { error: null, done: true };
}

/** Checks the current password by signing in with it, then sets the new one. */
export async function changePassword(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const next = passwordSchema.safeParse(formData.get("newPassword"));
  if (!next.success) return { error: "weak_password" };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email;
  if (!email) return { error: "unknown" };

  const check = await supabase.auth.signInWithPassword({ email: String(email), password: String(formData.get("currentPassword") ?? "") });
  if (check.error) return { error: "wrong_password" };
  const { error } = await supabase.auth.updateUser({ password: next.data });
  if (error) return { error: error.code === "weak_password" ? "weak_password" : "unknown" };
  return { error: null, done: true };
}

export async function closeAccount(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const lang = String(formData.get("lang"));
  try {
    await api("/me/close", { method: "POST", auth: true });
  } catch (error) {
    return { error: error instanceof ApiError && error.status === 409 ? "account_has_open_items" : "unknown" };
  }
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(`/${isLocale(lang) ? lang : "tr"}`);
}
