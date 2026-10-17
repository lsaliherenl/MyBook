"use server";

import { refresh, updateTag } from "next/cache";
import type {
  CheckoutManyResultDto,
  DeskCopyDto,
  DeskMemberDto,
  DeskMemberMatchDto,
  FineDto,
  ReturnCondition,
  ReturnResultDto,
} from "@mybook/shared";
import { run, post, type ActionResult } from "@/lib/action-result";
import { api } from "@/lib/api";

/** Desk calls return either the data or the API's refusal code, which the desk screen translates. */
export type DeskResult<T> = ActionResult<T>;

export async function findMembers(q: string) {
  return run(() => api<DeskMemberMatchDto[]>(`/admin/desk/lookup?q=${encodeURIComponent(q)}`, { auth: true }));
}

export async function loadMember(memberId: string) {
  return run(() => api<DeskMemberDto>(`/admin/desk/members/${encodeURIComponent(memberId)}`, { auth: true }));
}

/** A scanned copy before it is lent or checked in; with a member, whether it may go to them. */
export async function previewCopy(barcode: string, memberId?: string) {
  const query = memberId ? `?memberId=${encodeURIComponent(memberId)}` : "";
  return run(() => api<DeskCopyDto>(`/admin/desk/copies/${encodeURIComponent(barcode.trim())}${query}`, { auth: true }));
}

export async function checkOut(memberId: string, barcodes: string[], override: boolean) {
  const result = await run(() => api<CheckoutManyResultDto>("/admin/desk/checkouts", post({ memberId, barcodes, override })));
  if (result.ok) changed();
  return result;
}

export async function checkIn(barcode: string, condition: ReturnCondition) {
  const result = await run(() => api<ReturnResultDto>("/admin/desk/return", post({ barcode, condition })));
  if (result.ok) changed();
  return result;
}

/** "Take payment" / "Collect now": settles each fine in turn. */
export async function payFines(fineIds: string[]) {
  const result = await run(async () => {
    const paid: FineDto[] = [];
    for (const id of fineIds) paid.push(await api<FineDto>(`/admin/fines/${encodeURIComponent(id)}/pay`, post({})));
    return paid;
  });
  if (result.ok) refresh();
  return result;
}

/** Copies moved: book availability changes in the catalog, and the desk's side column re-renders. */
function changed() {
  updateTag("catalog");
  refresh();
}
