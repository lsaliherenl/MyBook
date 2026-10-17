import type { FineDto, LibrarySettingsDto, LoanDto, ReservationDto } from '@mybook/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { bookInclude, toBookSummary } from '../catalog/book.mapper.js';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { daysOverdue, overdueFine } from './rules.js';

export const reservationInclude = {
  book: { include: bookInclude },
  copy: { select: { barcode: true, shelfLocation: true } },
} satisfies Prisma.ReservationInclude;
export type ReservationRow = Prisma.ReservationGetPayload<{ include: typeof reservationInclude }>;

export const loanInclude = {
  copy: { select: { barcode: true, book: { include: bookInclude } } },
  fines: { select: { amount: true, reason: true } },
} satisfies Prisma.LoanInclude;
export type LoanRow = Prisma.LoanGetPayload<{ include: typeof loanInclude }>;

export const fineInclude = {
  loan: { select: { copy: { select: { book: { select: { title: true } } } } } },
} satisfies Prisma.FineInclude;
export type FineRow = Prisma.FineGetPayload<{ include: typeof fineInclude }>;

type Settings = Pick<LibrarySettingsDto, 'finePerDay' | 'maxRenewals'>;

export function toReservationDto(r: ReservationRow, supabase: SupabaseService, queuePosition: number | null): ReservationDto {
  return {
    id: r.id,
    code: r.code,
    status: r.status,
    book: toBookSummary(r.book, supabase),
    queuePosition: r.status === 'PENDING' ? queuePosition : null,
    copyBarcode: r.copy?.barcode ?? null,
    shelfLocation: r.copy?.shelfLocation ?? null,
    readyAt: r.readyAt?.toISOString() ?? null,
    expiresAt: r.expiresAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

export function toLoanDto(
  l: LoanRow,
  supabase: SupabaseService,
  settings: Settings,
  now: Date,
  options: { bookHasWaitingList?: boolean } = {},
): LoanDto {
  const overdue = l.status === 'ACTIVE' ? daysOverdue(l.dueAt, now) : daysOverdue(l.dueAt, l.returnedAt ?? now);
  const charged = l.fines.filter((f) => f.reason === 'OVERDUE').reduce((sum, f) => sum + Number(f.amount), 0);
  return {
    id: l.id,
    status: l.status,
    book: toBookSummary(l.copy.book, supabase),
    copyBarcode: l.copy.barcode,
    checkedOutAt: l.checkedOutAt.toISOString(),
    dueAt: l.dueAt.toISOString(),
    returnedAt: l.returnedAt?.toISOString() ?? null,
    renewCount: l.renewCount,
    canRenew:
      l.status === 'ACTIVE' && overdue === 0 && l.renewCount < settings.maxRenewals && !options.bookHasWaitingList,
    daysOverdue: overdue,
    daysLeft: l.status === 'ACTIVE' ? Math.max(0, Math.ceil((l.dueAt.getTime() - now.getTime()) / 86_400_000)) : 0,
    fineAmount: l.status === 'ACTIVE' ? overdueFine(overdue, settings.finePerDay) : charged,
  };
}

export function toFineDto(f: FineRow): FineDto {
  return {
    id: f.id,
    loanId: f.loanId,
    bookTitle: f.loan.copy.book.title,
    reason: f.reason,
    amount: Number(f.amount),
    status: f.status,
    note: f.note,
    issuedAt: f.issuedAt.toISOString(),
    paidAt: f.paidAt?.toISOString() ?? null,
  };
}

export function toSettingsDto(s: {
  loanDays: number;
  maxActiveLoans: number;
  maxRenewals: number;
  pickupWindowHours: number;
  finePerDay: Prisma.Decimal | number;
  fineBlockThreshold: Prisma.Decimal | number;
}): LibrarySettingsDto {
  return {
    loanDays: s.loanDays,
    maxActiveLoans: s.maxActiveLoans,
    maxRenewals: s.maxRenewals,
    pickupWindowHours: s.pickupWindowHours,
    finePerDay: Number(s.finePerDay),
    fineBlockThreshold: Number(s.fineBlockThreshold),
  };
}
