import { z } from 'zod';
import type { FineDto, LoanDto, MemberStandingDto, ReservationDto } from './circulation.js';
import type { ProfileDto } from './profile.js';

// ─── Member list (B17) ───────────────────────────────────────────────────────

export const ADMIN_MEMBER_FILTERS = ['all', 'STUDENT', 'ACADEMIC', 'STAFF', 'overdue', 'blocked'] as const;
export type AdminMemberFilter = (typeof ADMIN_MEMBER_FILTERS)[number];

export const adminMembersQuerySchema = z.object({
  /** Name, e-mail, student number or card number. */
  q: z.string().trim().max(120).optional(),
  filter: z.enum(ADMIN_MEMBER_FILTERS).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminMembersQuery = z.infer<typeof adminMembersQuerySchema>;

export interface AdminMemberRowDto {
  id: string;
  fullName: string;
  email: string;
  cardNumber: string;
  studentNumber: string | null;
  memberType: ProfileDto['memberType'];
  faculty: string | null;
  role: ProfileDto['role'];
  status: ProfileDto['status'];
  activeLoans: number;
  overdueLoans: number;
  /** Unpaid fines plus what overdue loans have run up so far. */
  fines: number;
  lastActivityAt: string | null;
}

export interface AdminMemberListDto {
  items: AdminMemberRowDto[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<AdminMemberFilter, number>;
  kpis: { members: number; newThisMonth: number; borrowing: number; blocked: number; withOverdue: number };
  maxActiveLoans: number;
  fineBlockThreshold: number;
}

// ─── One member ──────────────────────────────────────────────────────────────

export interface MemberHistoryItemDto {
  at: string;
  kind: 'borrowed' | 'returned' | 'reserved' | 'collected' | 'expired' | 'cancelled' | 'blocked' | 'unblocked';
  bookTitle: string | null;
  code: string | null;
  daysLate: number;
  fine: number | null;
}

export interface MemberNoteDto {
  id: string;
  text: string;
  author: string | null;
  at: string;
}

export interface AdminMemberDto {
  profile: ProfileDto;
  blockedReason: string | null;
  standing: MemberStandingDto;
  loans: LoanDto[];
  reservations: ReservationDto[];
  fines: FineDto[];
  /** Fines still running on overdue loans (charged when the book comes back). */
  accruingFines: number;
  year: { year: number; borrowed: number; returnedOnTimePct: number | null };
  history: MemberHistoryItemDto[];
  notes: MemberNoteDto[];
}

export const memberNoteSchema = z.object({ text: z.string().trim().min(2).max(1000) });

export const memberStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ACTIVE') }),
  z.object({ status: z.literal('BLOCKED'), reason: z.string().trim().min(3).max(300) }),
]);
export type MemberStatusInput = z.infer<typeof memberStatusSchema>;
