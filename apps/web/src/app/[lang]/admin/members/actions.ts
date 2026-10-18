"use server";

import { refresh, updateTag } from "next/cache";
import type { FineDto, LoanDto, MemberNoteDto, MemberStatusInput, ProfileDto, ReservationDto, Role } from "@mybook/shared";
import { post, run } from "@/lib/action-result";
import { api } from "@/lib/api";

async function mutate<T>(call: () => Promise<T>, catalog = false) {
  const result = await run(call);
  if (result.ok) {
    if (catalog) updateTag("catalog");
    refresh();
  }
  return result;
}

export async function renewLoan(loanId: string) {
  return mutate(() => api<LoanDto>(`/loans/${loanId}/renew`, post({})));
}

export async function cancelReservation(reservationId: string) {
  return mutate(() => api<ReservationDto>(`/reservations/${reservationId}`, { method: "DELETE", auth: true }), true);
}

export async function payFines(fineIds: string[]) {
  return mutate(async () => {
    const paid: FineDto[] = [];
    for (const id of fineIds) paid.push(await api<FineDto>(`/admin/fines/${id}/pay`, post({})));
    return paid;
  });
}

export async function waiveFine(fineId: string, note: string) {
  return mutate(() => api<FineDto>(`/admin/fines/${fineId}/waive`, post({ note })));
}

export async function setMemberStatus(memberId: string, input: MemberStatusInput) {
  return mutate(() => api<ProfileDto>(`/admin/members/${memberId}/status`, post(input, "PATCH")));
}

export async function setMemberRole(memberId: string, role: Role) {
  return mutate(() => api<ProfileDto>(`/admin/members/${memberId}/role`, post({ role }, "PATCH")));
}

export async function addMemberNote(memberId: string, text: string) {
  return mutate(() => api<MemberNoteDto[]>(`/admin/members/${memberId}/notes`, post({ text })));
}
