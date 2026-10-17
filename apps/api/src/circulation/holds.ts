/**
 * Transaction helpers shared by reservations, checkouts, returns and expiry. They take the
 * transaction client, lock the rows they change, and keep two invariants:
 *  - a copy is ON_HOLD exactly when a READY reservation points at it;
 *  - an AVAILABLE copy never sits on the shelf while someone is waiting for its title.
 */
import type { CirculationError, LibrarySettingsDto, MemberStandingDto } from '@mybook/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { toSettingsDto } from './circulation.mapper.js';
import { daysOverdue, overdueFine, pickupDeadline } from './rules.js';

export type Tx = Prisma.TransactionClient;

export async function loadSettings(tx: Tx): Promise<LibrarySettingsDto> {
  return toSettingsDto(await tx.librarySettings.findUniqueOrThrow({ where: { id: 1 } }));
}

/** Serialises concurrent actions for one member (two tabs reserving at once, desk + web). */
export async function lockMember(tx: Tx, memberId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM profiles WHERE id = ${memberId}::uuid FOR UPDATE`;
  return rows.length > 0;
}

export async function lockCopyByBarcode(tx: Tx, barcode: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM book_copies WHERE barcode = ${barcode} FOR UPDATE`;
  if (!rows[0]) return null;
  return tx.bookCopy.findUniqueOrThrow({ where: { id: rows[0].id } });
}

/** Locks and returns a shelf copy of the book, skipping copies another transaction is taking. */
export async function takeAvailableCopy(tx: Tx, bookId: string): Promise<string | null> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM book_copies
    WHERE book_id = ${bookId}::uuid AND status = 'AVAILABLE'
    ORDER BY barcode
    LIMIT 1
    FOR UPDATE SKIP LOCKED`;
  return rows[0]?.id ?? null;
}

export interface HoldNotice {
  reservationCode: string;
  memberName: string;
  expiresAt: string;
}

/** Puts a copy on the hold shelf for a reservation and starts its pickup window. */
export async function holdCopy(tx: Tx, reservationId: string, copyId: string, now: Date, settings: LibrarySettingsDto): Promise<HoldNotice> {
  await tx.bookCopy.update({ where: { id: copyId }, data: { status: 'ON_HOLD' } });
  const r = await tx.reservation.update({
    where: { id: reservationId },
    data: { status: 'READY', copyId, readyAt: now, expiresAt: pickupDeadline(now, settings.pickupWindowHours) },
    include: { member: { select: { fullName: true } } },
  });
  return { reservationCode: r.code, memberName: r.member.fullName, expiresAt: r.expiresAt!.toISOString() };
}

/**
 * A copy is free again (returned, or its hold was cancelled or expired): hand it to the next
 * reader in line for the title, otherwise put it back on the shelf.
 */
export async function releaseCopy(
  tx: Tx,
  copy: { id: string; bookId: string },
  now: Date,
  settings: LibrarySettingsDto,
): Promise<HoldNotice | null> {
  const [next] = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM reservations
    WHERE book_id = ${copy.bookId}::uuid AND status = 'PENDING'
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED`;
  if (next) return holdCopy(tx, next.id, copy.id, now, settings);
  await tx.bookCopy.update({ where: { id: copy.id }, data: { status: 'AVAILABLE' } });
  return null;
}

export interface Standing extends MemberStandingDto {
  /** A reason that blocks every new reservation or checkout (ignores the loan limit). */
  blocking: CirculationError | null;
  slotsLeft: number;
}

/** What a member may do right now: limits, overdue loans and fines. */
export async function memberStanding(tx: Tx, memberId: string, settings: LibrarySettingsDto, now: Date): Promise<Standing> {
  // Sequential on purpose: inside a transaction all queries share one connection.
  const profile = await tx.profile.findUniqueOrThrow({ where: { id: memberId }, select: { status: true } });
  const activeLoans = await tx.loan.findMany({ where: { memberId, status: 'ACTIVE' }, select: { dueAt: true } });
  const openReservations = await tx.reservation.count({ where: { memberId, status: { in: ['PENDING', 'READY'] } } });
  const unpaid = await tx.fine.aggregate({ where: { memberId, status: 'UNPAID' }, _sum: { amount: true } });

  const unpaidFines = Number(unpaid._sum.amount ?? 0);
  const overdue = activeLoans.filter((l) => l.dueAt < now);
  const accrued = overdue.reduce((sum, l) => sum + overdueFine(daysOverdue(l.dueAt, now), settings.finePerDay), 0);
  const slotsLeft = Math.max(0, settings.maxActiveLoans - activeLoans.length - openReservations);

  const blocking: CirculationError | null =
    profile.status === 'BLOCKED'
      ? 'member_blocked'
      : overdue.length > 0
        ? 'loan_overdue'
        : settings.fineBlockThreshold > 0 && unpaidFines + accrued >= settings.fineBlockThreshold
          ? 'fines_over_limit'
          : null;
  const blockedReason = blocking ?? (slotsLeft === 0 ? 'loan_limit_reached' : null);

  return {
    activeLoans: activeLoans.length,
    openReservations,
    maxActiveLoans: settings.maxActiveLoans,
    unpaidFines,
    fineBlockThreshold: settings.fineBlockThreshold,
    canBorrow: blockedReason === null,
    blockedReason,
    blocking,
    slotsLeft,
  };
}

export function publicStanding({ blocking: _b, slotsLeft: _s, ...dto }: Standing): MemberStandingDto {
  return dto;
}
