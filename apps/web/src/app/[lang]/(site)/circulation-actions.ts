"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { LoanDto, ReservationDto } from "@mybook/shared";
import { isLocale } from "@/i18n/config";
import { api, ApiError } from "@/lib/api";
import { readBag, writeBag } from "@/lib/bag";

export type ActionState = { error: string | null; message?: string };

const localeOf = (formData: FormData) => {
  const lang = String(formData.get("lang"));
  return isLocale(lang) ? lang : "tr";
};

/** "Reserve now" / "Join waitlist" on a book page: one book, straight to the confirmation. */
export async function reserveBook(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeOf(formData);
  const bookId = String(formData.get("bookId"));
  const back = String(formData.get("back") ?? `/${locale}`);
  let reservations: ReservationDto[];
  try {
    reservations = await api<ReservationDto[]>("/reservations", { method: "POST", auth: true, body: JSON.stringify({ bookIds: [bookId] }) });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect(`/${locale}/login?next=${encodeURIComponent(back)}`);
    return { error: error instanceof ApiError ? (error.code ?? "unknown") : "unknown" };
  }
  updateTag("catalog");
  // A reserved book no longer needs to wait in the bag.
  const bag = await readBag();
  if (bag.includes(bookId)) await writeBag(bag.filter((id) => id !== bookId));
  redirect(`/${locale}/reservations/confirmed?ids=${reservations.map((r) => r.id).join(",")}`);
}

export async function renewLoan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const loanId = String(formData.get("loanId"));
  try {
    const loan = await api<LoanDto>(`/loans/${encodeURIComponent(loanId)}/renew`, { method: "POST", auth: true });
    refresh();
    return { error: null, message: loan.dueAt };
  } catch (error) {
    return { error: error instanceof ApiError ? (error.code ?? "unknown") : "unknown" };
  }
}

/** Cancels one reservation, or several when `reservationIds` is a comma-separated list (a whole pickup pass). */
export async function cancelReservation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ids = String(formData.get("reservationIds") ?? formData.get("reservationId")).split(",").filter(Boolean);
  try {
    for (const id of ids) await api(`/reservations/${encodeURIComponent(id)}`, { method: "DELETE", auth: true });
    updateTag("catalog");
    refresh();
    return { error: null, message: "" };
  } catch (error) {
    return { error: error instanceof ApiError ? (error.code ?? "unknown") : "unknown" };
  }
}
