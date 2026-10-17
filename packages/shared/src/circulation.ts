import { z } from 'zod';
import type { BookSummaryDto } from './catalog.js';

// ─── Requests ────────────────────────────────────────────────────────────────

/** "Reserve all" from the borrow bag. */
export const createReservationsSchema = z.object({
  bookIds: z.array(z.uuid()).min(1).max(10),
});
export type CreateReservationsInput = z.infer<typeof createReservationsSchema>;

const barcodeSchema = z.string().trim().toUpperCase().min(3).max(32);

/** At the desk: the member (card number, reservation code, e-mail or student number) and the scanned copy. */
export const checkoutSchema = z.object({
  memberId: z.uuid(),
  barcode: barcodeSchema,
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/**
 * Every copy the member takes in one visit, lent together or not at all. `override` (admins only)
 * lends despite fines over the limit; it is written to the audit log.
 */
export const checkoutManySchema = z.object({
  memberId: z.uuid(),
  barcodes: z.array(barcodeSchema).min(1).max(10),
  override: z.boolean().default(false),
});
export type CheckoutManyInput = z.infer<typeof checkoutManySchema>;

/** How the copy came back. A damaged copy goes to repair instead of the shelf or the next reader. */
export const RETURN_CONDITIONS = ['same', 'worn', 'damaged'] as const;
export type ReturnCondition = (typeof RETURN_CONDITIONS)[number];

export const returnSchema = z.object({
  barcode: barcodeSchema,
  condition: z.enum(RETURN_CONDITIONS).default('same'),
});
export type ReturnInput = z.input<typeof returnSchema>;

/** A scanned copy before anything happens; with `memberId`, whether it can be lent to that member. */
export const deskCopyQuerySchema = z.object({
  memberId: z.uuid().optional(),
});

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
  /** When it was collected, cancelled or ran out; null while open. */
  closedAt: string | null;
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

/** A member found at the desk by card, pickup code, student number, e-mail or name. */
export interface DeskMemberMatchDto {
  id: string;
  fullName: string;
  email: string;
  cardNumber: string;
  studentNumber: string | null;
}

export interface DeskMemberDto {
  id: string;
  fullName: string;
  email: string;
  cardNumber: string;
  studentNumber: string | null;
  memberType: 'STUDENT' | 'ACADEMIC' | 'STAFF';
  faculty: string | null;
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

export interface CheckoutManyResultDto {
  loans: LoanDto[];
  /** Pickup codes of the reservations these checkouts fulfilled. */
  reservationCodes: string[];
  dueAt: string;
}

export type CopyStatus = 'AVAILABLE' | 'ON_HOLD' | 'ON_LOAN' | 'IN_REPAIR' | 'LOST' | 'WITHDRAWN';

/** What the desk sees after scanning a copy, before checking it out or in. */
export interface DeskCopyDto {
  barcode: string;
  status: CopyStatus;
  shelfLocation: string | null;
  book: BookSummaryDto;
  /** The open loan, when the copy is out. */
  loan: {
    id: string;
    memberId: string;
    memberName: string;
    checkedOutAt: string;
    dueAt: string;
    daysOverdue: number;
    /** Fine the return would charge now. */
    fine: number;
  } | null;
  /** Who gets this copy next if it comes back now. */
  nextReader: { reservationCode: string; memberName: string } | null;
  /** With a member: why this copy cannot be lent to them, or null when it can. */
  checkoutRefusal: CirculationError | null;
}

/** One pickup code waiting at (or collected from) the hold shelf today. */
export interface DeskPickupDto {
  code: string;
  memberId: string;
  memberName: string;
  books: string[];
  status: 'READY' | 'COLLECTED';
  /** Earliest deadline among the books still on the shelf. */
  expiresAt: string | null;
  collectedAt: string | null;
}

export interface DeskActivityDto {
  id: string;
  at: string;
  kind: 'out' | 'in' | 'hold';
  bookTitle: string;
  memberName: string;
  /** Pickup code for checkouts of a reservation and for new holds. */
  code: string | null;
  /** Fine charged on return. */
  fine: number | null;
}

export interface DeskTodayDto {
  pickups: DeskPickupDto[];
  /** Pickup codes whose deadline falls before the library closes today. */
  expiringToday: number;
  recent: DeskActivityDto[];
}

export interface DashboardDto {
  activeLoans: number;
  /** Active loans at this moment a week ago, for the trend. */
  activeLoansWeekAgo: number;
  overdueLoans: number;
  awaitingPickup: number;
  /** Ready reservations whose pickup window ends today. */
  expiringToday: number;
  waitingList: number;
  newMembersThisWeek: number;
  unpaidFinesTotal: number;
  /** Checkouts per ISO week, oldest first. */
  loansPerWeek: { weekStart: string; count: number }[];
  /** This week, Monday to Sunday (library time). */
  week: { date: string; checkouts: number; returns: number }[];
  /** Members whose unpaid and running fines reach the borrowing limit. */
  membersOverLimit: { count: number; limit: number; names: string[] };
  /** The title with the most readers waiting. */
  longestWaitlist: { title: string; slug: string; waiting: number } | null;
  /** Loans more than two weeks overdue. */
  longOverdue: number;
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
