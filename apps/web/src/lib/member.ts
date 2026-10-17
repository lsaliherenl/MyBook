import "server-only";
import type { LoanDto, MemberStandingDto, ReservationDto } from "@mybook/shared";
import { api } from "./api";
import { createSupabaseServerClient } from "./supabase/server";

export interface MemberCirculation {
  standing: MemberStandingDto | null;
  activeLoans: LoanDto[];
  openReservations: ReservationDto[];
}

/** The signed-in member's loans and open reservations (uncached), or null for visitors. */
export async function getMemberCirculation(): Promise<MemberCirculation | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  const [standing, activeLoans, openReservations] = await Promise.all([
    api<MemberStandingDto>("/me/standing", { auth: true }).catch(() => null),
    api<LoanDto[]>("/me/loans?status=active", { auth: true }).catch(() => []),
    api<ReservationDto[]>("/me/reservations?status=open", { auth: true }).catch(() => []),
  ]);
  return { standing, activeLoans, openReservations };
}
