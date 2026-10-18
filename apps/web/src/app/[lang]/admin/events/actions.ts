"use server";

import { refresh, updateTag } from "next/cache";
import type { AdminEventDto, SaveEventInput } from "@mybook/shared";
import { post, run } from "@/lib/action-result";
import { api } from "@/lib/api";

/** Events change the member site's programme pages, so the cached event lists refresh too. */
async function mutate<T>(call: () => Promise<T>) {
  const result = await run(call);
  if (result.ok) {
    updateTag("events");
    refresh();
  }
  return result;
}

export async function createEvent(input: SaveEventInput) {
  return mutate(() => api<AdminEventDto>("/admin/events", post(input)));
}

export async function updateEvent(eventId: string, input: SaveEventInput) {
  return mutate(() => api<AdminEventDto>(`/admin/events/${eventId}`, post(input, "PATCH")));
}

export async function deleteEvent(eventId: string) {
  return mutate(() => api<void>(`/admin/events/${eventId}`, { method: "DELETE", auth: true }));
}
