"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { MyRsvpDto } from "@mybook/shared";
import { isLocale } from "@/i18n/config";
import { api, ApiError } from "@/lib/api";

export type RsvpState = { error: string | null; rsvp?: MyRsvpDto };

/** RSVP, cancel or join the waitlist; `intent` is "join" or "leave". */
export async function changeRsvp(_prev: RsvpState, formData: FormData): Promise<RsvpState> {
  const slug = String(formData.get("slug"));
  const lang = String(formData.get("lang"));
  const intent = formData.get("intent") === "leave" ? "DELETE" : "POST";
  let rsvp: MyRsvpDto;
  try {
    rsvp = await api<MyRsvpDto>(`/events/${encodeURIComponent(slug)}/rsvp`, { method: intent, auth: true });
  } catch (error) {
    const locale = isLocale(lang) ? lang : "tr";
    if (error instanceof ApiError && error.status === 401) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/events/${slug}`)}`);
    return { error: error instanceof ApiError ? (error.code ?? "unknown") : "unknown" };
  }
  updateTag("events");
  refresh();
  return { error: null, rsvp };
}

export async function setEventReminder(slug: string, remind: boolean): Promise<void> {
  await api(`/events/${encodeURIComponent(slug)}/rsvp`, { method: "PATCH", auth: true, body: JSON.stringify({ remind }) });
}
