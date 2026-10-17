import { z } from 'zod';
import type { BookSummaryDto } from './catalog.js';

// ─── Requests ────────────────────────────────────────────────────────────────

/** "Reserve all" from the borrow bag. */
export const createReservationsSchema = z.object({
  bookIds: z.array(z.uuid()).min(1).max(10),
});
export type CreateReservationsInput = z.infer<typeof createReservationsSchema>;

/** At the desk: the member (card number, reservation code, e-mail or student number) and the scanned copy. */
export const checkoutSchema = z.object({
  memberId: z.uuid(),
  barcode: z.string().trim().toUpperCase().min(3).max(32),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const returnSchema = z.object({
  barcode: z.string().trim().toUpperCase().min(3).max(32),
});
export type ReturnInput = z.infer<typeof returnSchema>;

export const deskLookupSchema = z.object({
  q: z.string().trim().min(2).max(120),
});

export const waiveFineSchema = z.object({
  note: z.string().trim().min(3).max(500),
});

export const updateSettingsSchema = z
  .object({
    loanDays: z.number().int().min(1).max(120),
    maxActiveLoans: z.number().int().min(1).max(50),
    maxRenewals: z.number().int().min(0).max(10),
    pickupWindowHours: z.number().int().min(1).max(24 * 14),
    finePerDay: z.number().min(0).max(1000),
    fineBlockThreshold: z.number().min(0).max(100000),
  })
  .partial();
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// ─── Errors ──────────────────────────────────────────────────────────────────

/**
 * Machine-readable reasons a circulation action is refused. The web app maps each code to a
 * translated message, so the API never has to know the reader's language.
 */
export const CIRCULATION_ERRORS = [
  'member_blocked',
  'fines_over_limit',
  'loan_limit_reached',
  'already_reserved',
  'already_borrowed',
  'book_not_found',
  'no_copies',
  'copy_not_found',
  'copy_not_circulating',
  'copy_on_loan',
  'copy_reserved_for_another',
  'copy_not_on_loan',
  'reservation_not_found',
  'reservation_not_cancellable',
  'loan_not_found',
  'loan_overdue',
  'renewal_limit_reached',
  'book_has_waiting_list',
  'fine_not_unpaid',
] as const;
export type CirculationError = (typeof CIRCULATION_ERRORS)[number];

// ─── Responses ───────────────────────────────────────────────────────────────

export type ReservationStatus = 'PENDING' | 'READY' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';
export type LoanStatus = 'ACTIVE' | 'RETURNED' | 'LOST';
export type FineStatus = 'UNPAID' | 'PAID' | 'WAIVED';

export interface ReservationDto {
  id: string;
  code: string;
  status: ReservationStatus;
  book: BookSummaryDto;
  /** 1 = next in line; only for PENDING reservations. */
  queuePosition: number | null;
  copyBarcode: string | null;
  shelfLocation: string | null;
  readyAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface LoanDto {
  id: string;
  status: LoanStatus;
  book: BookSummaryDto;
  copyBarcode: string;
  checkedOutAt: string;
  dueAt: string;
  returnedAt: string | null;
  renewCount: number;
  canRenew: boolean;
  /** Whole days past the due date (0 when on time). */
  daysOverdue: number;
  /** Days until the due date, counting today (0 once it is due or returned). */
  daysLeft: number;
  /** Fine the loan has run up so far, or was charged on return. */
  fineAmount: number;
}

export interface FineDto {
  id: string;
  loanId: string;
  bookTitle: string;
  reason: 'OVERDUE' | 'LOST' | 'DAMAGED';
  amount: number;
  status: FineStatus;
  note: string | null;
  issuedAt: string;
  paidAt: string | null;
}

export interface MemberStandingDto {
  activeLoans: number;
  openReservations: number;
  maxActiveLoans: number;
  unpaidFines: number;
  fineBlockThreshold: number;
  /** Whether the member may reserve or borrow right now, and if not why. */
  canBorrow: boolean;
  blockedReason: CirculationError | null;
}

export interface DeskMemberDto {
  id: string;
  fullName: string;
  email: string;
  cardNumber: string;
  studentNumber: string | null;
  status: 'ACTIVE' | 'BLOCKED';
  standing: MemberStandingDto;
  readyReservations: ReservationDto[];
  activeLoans: LoanDto[];
  unpaidFines: FineDto[];
}

export interface CheckoutResultDto {
  loan: LoanDto;
  /** Set when the checkout fulfilled one of the member's reservations. */
  reservationCode: string | null;
}

export interface ReturnResultDto {
  loan: LoanDto;
  fine: FineDto | null;
  /** Set when the copy should go straight to the hold shelf for the next reader. */
  holdFor: { reservationCode: string; memberName: string; expiresAt: string } | null;
}

export interface OverdueRowDto {
  loanId: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  cardNumber: string;
  bookTitle: string;
  copyBarcode: string;
  dueAt: string;
  daysOverdue: number;
  accruedFine: number;
}

export interface DashboardDto {
  activeLoans: number;
  overdueLoans: number;
  awaitingPickup: number;
  waitingList: number;
  newMembersThisWeek: number;
  unpaidFinesTotal: number;
  /** Checkouts per ISO week, oldest first. */
  loansPerWeek: { weekStart: string; count: number }[];
}

export interface PopularBookDto {
  book: BookSummaryDto;
  loans: number;
}

export interface LibrarySettingsDto {
  loanDays: number;
  maxActiveLoans: number;
  maxRenewals: number;
  pickupWindowHours: number;
  finePerDay: number;
  fineBlockThreshold: number;
}
