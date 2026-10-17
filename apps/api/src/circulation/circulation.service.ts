import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CheckoutResultDto,
  FineDto,
  LoanDto,
  MemberStandingDto,
  ReservationDto,
  ReturnResultDto,
} from '@mybook/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { ROLE_RANK } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { CirculationException } from './circulation.exception.js';
import {
  fineInclude,
  loanInclude,
  reservationInclude,
  toFineDto,
  toLoanDto,
  toReservationDto,
  type ReservationRow,
} from './circulation.mapper.js';
import { Clock } from './clock.js';
import {
  holdCopy,
  loadSettings,
  lockCopyByBarcode,
  lockMember,
  memberStanding,
  publicStanding,
  releaseCopy,
  takeAvailableCopy,
  type Tx,
} from './holds.js';
import { addDays, CIRCULATING_STATUSES, daysOverdue, overdueFine, reservationCode } from './rules.js';

const TX_OPTIONS = { timeout: 20_000, maxWait: 10_000 };

/**
 * Reservations, desk checkouts, returns and renewals. Every state change runs in one database
 * transaction that locks the member and the copies involved; partial unique indexes in the
 * database back up the rules in case two requests still race.
 */
@Injectable()
export class CirculationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly clock: Clock,
  ) {}

  // ─── Member: reservations ──────────────────────────────────────────────────

  /** "Reserve all" from the borrow bag. All books are reserved, or none is. */
  async reserve(member: AuthUser, bookIds: string[]): Promise<ReservationDto[]> {
    const ids = [...new Set(bookIds)];
    const now = this.clock.now();

    const reservationIds = await this.prisma.$transaction(async (tx) => {
      await lockMember(tx, member.id);
      const settings = await loadSettings(tx);
      const standing = await memberStanding(tx, member.id, settings, now);
      if (standing.blocking) throw new CirculationException(standing.blocking);
      if (standing.slotsLeft < ids.length) {
        throw new CirculationException('loan_limit_reached', { slotsLeft: standing.slotsLeft });
      }

      for (const bookId of ids) {
        const book = await tx.book.findUnique({ where: { id: bookId }, select: { id: true } });
        if (!book) throw new CirculationException('book_not_found', { bookId });
        const copies = await tx.bookCopy.count({ where: { bookId, status: { in: [...CIRCULATING_STATUSES] } } });
        if (copies === 0) throw new CirculationException('no_copies', { bookId });
        const open = await tx.reservation.count({ where: { memberId: member.id, bookId, status: { in: ['PENDING', 'READY'] } } });
        if (open > 0) throw new CirculationException('already_reserved', { bookId });
        const borrowed = await tx.loan.count({ where: { memberId: member.id, status: 'ACTIVE', copy: { bookId } } });
        if (borrowed > 0) throw new CirculationException('already_borrowed', { bookId });
      }

      // Books reserved together share one pickup code, so the member shows a single pass at the desk.
      const code = await this.uniqueCode(tx);
      const created: string[] = [];
      for (const bookId of ids) {
        const reservation = await tx.reservation.create({ data: { code, memberId: member.id, bookId, createdAt: now } });
        const copyId = await takeAvailableCopy(tx, bookId);
        if (copyId) await holdCopy(tx, reservation.id, copyId, now, settings);
        created.push(reservation.id);
      }
      await tx.auditLog.create({
        data: { actorId: member.id, action: 'reservation.create', entityType: 'profile', entityId: member.id, data: { bookIds: ids } },
      });
      return created;
    }, TX_OPTIONS);

    const rows = await this.prisma.reservation.findMany({ where: { id: { in: reservationIds } }, include: reservationInclude });
    return this.withQueuePositions(rows);
  }

  async cancelReservation(actor: AuthUser, reservationId: string): Promise<ReservationDto> {
    const now = this.clock.now();
    const isStaff = ROLE_RANK[actor.role] >= ROLE_RANK.LIBRARIAN;

    await this.prisma.$transaction(async (tx) => {
      const r = await tx.reservation.findUnique({ where: { id: reservationId } });
      if (!r || (r.memberId !== actor.id && !isStaff)) throw new CirculationException('reservation_not_found');
      await lockMember(tx, r.memberId);
      const current = await tx.reservation.findUniqueOrThrow({ where: { id: reservationId } });
      if (current.status !== 'PENDING' && current.status !== 'READY') throw new CirculationException('reservation_not_cancellable');

      await tx.reservation.update({ where: { id: reservationId }, data: { status: 'CANCELLED', cancelledAt: now, copyId: null } });
      if (current.status === 'READY' && current.copyId) {
        await releaseCopy(tx, { id: current.copyId, bookId: current.bookId }, now, await loadSettings(tx));
      }
      await tx.auditLog.create({
        data: { actorId: actor.id, action: 'reservation.cancel', entityType: 'reservation', entityId: reservationId },
      });
    }, TX_OPTIONS);

    const row = await this.prisma.reservation.findUniqueOrThrow({ where: { id: reservationId }, include: reservationInclude });
    return toReservationDto(row, this.supabase, null);
  }

  /** READY reservations whose pickup window has passed: expire them and pass the copy on. */
  async expireHolds(): Promise<number> {
    const now = this.clock.now();
    const due = await this.prisma.reservation.findMany({
      where: { status: 'READY', expiresAt: { lt: now } },
      select: { id: true },
    });
    let expired = 0;
    for (const { id } of due) {
      await this.prisma.$transaction(async (tx) => {
        const [locked] = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM reservations WHERE id = ${id}::uuid AND status = 'READY' FOR UPDATE SKIP LOCKED`;
        if (!locked) return;
        const r = await tx.reservation.update({ where: { id }, data: { status: 'EXPIRED' } });
        if (r.copyId) await releaseCopy(tx, { id: r.copyId, bookId: r.bookId }, now, await loadSettings(tx));
        expired++;
      }, TX_OPTIONS);
    }
    return expired;
  }

  // ─── Member: loans ─────────────────────────────────────────────────────────

  async renew(member: AuthUser, loanId: string): Promise<LoanDto> {
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await lockMember(tx, member.id);
      const loan = await tx.loan.findUnique({ where: { id: loanId }, include: { copy: { select: { bookId: true } } } });
      if (!loan || loan.memberId !== member.id || loan.status !== 'ACTIVE') throw new CirculationException('loan_not_found');
      const settings = await loadSettings(tx);
      if (daysOverdue(loan.dueAt, now) > 0) throw new CirculationException('loan_overdue');
      if (loan.renewCount >= settings.maxRenewals) throw new CirculationException('renewal_limit_reached');
      const waiting = await tx.reservation.count({ where: { bookId: loan.copy.bookId, status: 'PENDING' } });
      if (waiting > 0) throw new CirculationException('book_has_waiting_list');

      await tx.loan.update({
        where: { id: loanId },
        data: { dueAt: addDays(loan.dueAt, settings.loanDays), renewCount: { increment: 1 } },
      });
      await tx.auditLog.create({ data: { actorId: member.id, action: 'loan.renew', entityType: 'loan', entityId: loanId } });
    }, TX_OPTIONS);
    return this.loanDto(loanId);
  }

  // ─── Desk ──────────────────────────────────────────────────────────────────

  /**
   * The librarian scans a copy for a member. Fulfils the member's reservation for the title when
   * there is one; otherwise it is a walk-in loan, allowed when nobody else is waiting for the copy.
   */
  async checkout(actor: AuthUser, memberId: string, barcode: string): Promise<CheckoutResultDto> {
    const now = this.clock.now();

    const result = await this.prisma.$transaction(async (tx) => {
      if (!(await lockMember(tx, memberId))) throw new NotFoundException('Member not found');
      const copy = await lockCopyByBarcode(tx, barcode);
      if (!copy) throw new CirculationException('copy_not_found', { barcode });
      if (copy.status === 'ON_LOAN') throw new CirculationException('copy_on_loan', { barcode });
      if (copy.status !== 'AVAILABLE' && copy.status !== 'ON_HOLD') {
        throw new CirculationException('copy_not_circulating', { barcode, status: copy.status });
      }

      const settings = await loadSettings(tx);
      const standing = await memberStanding(tx, memberId, settings, now);
      if (standing.blocking) throw new CirculationException(standing.blocking);

      const borrowed = await tx.loan.count({ where: { memberId, status: 'ACTIVE', copy: { bookId: copy.bookId } } });
      if (borrowed > 0) throw new CirculationException('already_borrowed');

      const own = await tx.reservation.findFirst({
        where: { memberId, bookId: copy.bookId, status: { in: ['PENDING', 'READY'] } },
      });

      if (copy.status === 'ON_HOLD') {
        const holder = await tx.reservation.findFirst({ where: { copyId: copy.id, status: 'READY' } });
        if (holder && holder.memberId !== memberId) {
          throw new CirculationException('copy_reserved_for_another', { reservationCode: holder.code });
        }
      } else {
        // An available copy while others queue for the title would be a broken invariant; respect the queue anyway.
        const othersWaiting = await tx.reservation.count({
          where: { bookId: copy.bookId, status: 'PENDING', memberId: { not: memberId } },
        });
        if (othersWaiting > 0 && !own) throw new CirculationException('copy_reserved_for_another');
      }

      if (!own && standing.slotsLeft < 1) throw new CirculationException('loan_limit_reached', { slotsLeft: 0 });

      await tx.bookCopy.update({ where: { id: copy.id }, data: { status: 'ON_LOAN' } });
      const loan = await tx.loan.create({
        data: {
          copyId: copy.id,
          memberId,
          reservationId: own?.id ?? null,
          checkedOutAt: now,
          dueAt: addDays(now, settings.loanDays),
          checkedOutById: actor.id,
        },
      });
      if (own) {
        await tx.reservation.update({ where: { id: own.id }, data: { status: 'FULFILLED', fulfilledAt: now, copyId: copy.id } });
        // The member brought a different copy than the one held for them: the held copy is free again.
        if (own.status === 'READY' && own.copyId && own.copyId !== copy.id) {
          await releaseCopy(tx, { id: own.copyId, bookId: own.bookId }, now, settings);
        }
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'loan.checkout',
          entityType: 'loan',
          entityId: loan.id,
          data: { memberId, barcode, reservationCode: own?.code ?? null },
        },
      });
      return { loanId: loan.id, reservationCode: own?.code ?? null };
    }, TX_OPTIONS);

    return { loan: await this.loanDto(result.loanId), reservationCode: result.reservationCode };
  }

  /** The librarian scans a returned copy: closes the loan, charges a late fine, routes the copy on. */
  async returnCopy(actor: AuthUser, barcode: string): Promise<ReturnResultDto> {
    const now = this.clock.now();

    const result = await this.prisma.$transaction(async (tx) => {
      const copy = await lockCopyByBarcode(tx, barcode);
      if (!copy) throw new CirculationException('copy_not_found', { barcode });
      const loan = await tx.loan.findFirst({ where: { copyId: copy.id, status: 'ACTIVE' } });
      if (!loan) throw new CirculationException('copy_not_on_loan', { barcode });
      await lockMember(tx, loan.memberId);
      const settings = await loadSettings(tx);

      await tx.loan.update({ where: { id: loan.id }, data: { status: 'RETURNED', returnedAt: now, returnedToId: actor.id } });

      const late = daysOverdue(loan.dueAt, now);
      const amount = overdueFine(late, settings.finePerDay);
      const fine =
        amount > 0
          ? await tx.fine.create({
              data: { loanId: loan.id, memberId: loan.memberId, reason: 'OVERDUE', amount, issuedAt: now, note: `${late} day(s) late` },
            })
          : null;

      const holdFor = await releaseCopy(tx, copy, now, settings);
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'loan.return',
          entityType: 'loan',
          entityId: loan.id,
          data: { barcode, daysOverdue: late, fine: amount, holdFor: holdFor?.reservationCode ?? null },
        },
      });
      return { loanId: loan.id, fineId: fine?.id ?? null, holdFor };
    }, TX_OPTIONS);

    const fine = result.fineId
      ? toFineDto(await this.prisma.fine.findUniqueOrThrow({ where: { id: result.fineId }, include: fineInclude }))
      : null;
    return { loan: await this.loanDto(result.loanId), fine, holdFor: result.holdFor };
  }

  // ─── Reads ─────────────────────────────────────────────────────────────────

  async standing(memberId: string): Promise<MemberStandingDto> {
    return publicStanding(
      await this.prisma.$transaction(async (tx) => memberStanding(tx, memberId, await loadSettings(tx), this.clock.now())),
    );
  }

  async reservationsOf(memberId: string, open = false): Promise<ReservationDto[]> {
    const rows = await this.prisma.reservation.findMany({
      where: { memberId, ...(open ? { status: { in: ['PENDING', 'READY'] } } : {}) },
      include: reservationInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return this.withQueuePositions(rows);
  }

  async loansOf(memberId: string, active?: boolean): Promise<LoanDto[]> {
    const settings = await this.prisma.$transaction((tx) => loadSettings(tx));
    const rows = await this.prisma.loan.findMany({
      where: { memberId, ...(active === undefined ? {} : active ? { status: 'ACTIVE' } : { status: { not: 'ACTIVE' } }) },
      include: loanInclude,
      orderBy: { checkedOutAt: 'desc' },
      take: 200,
    });
    const now = this.clock.now();
    const waitingBooks = await this.booksWithWaitingList(rows.map((l) => l.copy.book.id));
    return rows.map((l) => toLoanDto(l, this.supabase, settings, now, { bookHasWaitingList: waitingBooks.has(l.copy.book.id) }));
  }

  async finesOf(memberId: string, unpaidOnly = false): Promise<FineDto[]> {
    const rows = await this.prisma.fine.findMany({
      where: { memberId, ...(unpaidOnly ? { status: 'UNPAID' } : {}) },
      include: fineInclude,
      orderBy: { issuedAt: 'desc' },
    });
    return rows.map(toFineDto);
  }

  async loanDto(loanId: string): Promise<LoanDto> {
    const settings = await this.prisma.$transaction((tx) => loadSettings(tx));
    const loan = await this.prisma.loan.findUniqueOrThrow({ where: { id: loanId }, include: loanInclude });
    const waiting = await this.booksWithWaitingList([loan.copy.book.id]);
    return toLoanDto(loan, this.supabase, settings, this.clock.now(), { bookHasWaitingList: waiting.size > 0 });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async uniqueCode(tx: Tx): Promise<string> {
    for (;;) {
      const code = reservationCode();
      if (!(await tx.reservation.findFirst({ where: { code }, select: { id: true } }))) return code;
    }
  }

  private async booksWithWaitingList(bookIds: string[]): Promise<Set<string>> {
    if (bookIds.length === 0) return new Set();
    const rows = await this.prisma.reservation.groupBy({
      by: ['bookId'],
      where: { bookId: { in: bookIds }, status: 'PENDING' },
    });
    return new Set(rows.map((r) => r.bookId));
  }

  /** Queue position of each PENDING reservation among everyone waiting for the same title. */
  private async withQueuePositions(rows: ReservationRow[]): Promise<ReservationDto[]> {
    const result: ReservationDto[] = [];
    for (const r of rows) {
      const position =
        r.status === 'PENDING'
          ? 1 + (await this.prisma.reservation.count({ where: { bookId: r.bookId, status: 'PENDING', createdAt: { lt: r.createdAt } } }))
          : null;
      result.push(toReservationDto(r, this.supabase, position));
    }
    return result;
  }
}
