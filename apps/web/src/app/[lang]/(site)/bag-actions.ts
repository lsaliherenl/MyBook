"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { ReservationDto } from "@mybook/shared";
import { isLocale } from "@/i18n/config";
import { api, ApiError } from "@/lib/api";
import { BAG_MAX, readBag, writeBag } from "@/lib/bag";

const UUID = /^[0-9a-f-]{36}$/i;

export async function addToBag(bookId: string): Promise<{ ok: boolean; full?: boolean }> {
  if (!UUID.test(bookId)) return { ok: false };
  const bag = await readBag();
  if (bag.includes(bookId)) return { ok: true };
  if (bag.length >= BAG_MAX) return { ok: false, full: true };
  await writeBag([...bag, bookId]);
  return { ok: true };
}

export async function removeFromBag(bookId: string): Promise<void> {
  await writeBag((await readBag()).filter((id) => id !== bookId));
}

export type ReserveState = { error: string | null };

/** Reserves everything in the bag in one go (the API is all-or-nothing), then shows the confirmation. */
export async function reserveBag(_prev: ReserveState, formData: FormData): Promise<ReserveState> {
  const lang = String(formData.get("lang"));
  const locale = isLocale(lang) ? lang : "tr";
  const bookIds = await readBag();
  if (bookIds.length === 0) return { error: "empty" };

  let reservations: ReservationDto[];
  try {
    reservations = await api<ReservationDto[]>("/reservations", { method: "POST", auth: true, body: JSON.stringify({ bookIds }) });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}`)}`);
    return { error: error instanceof ApiError ? (error.code ?? "unknown") : "unknown" };
  }

  updateTag("catalog");
  await writeBag([]);
  redirect(`/${locale}/reservations/confirmed?ids=${reservations.map((r) => r.id).join(",")}`);
}
