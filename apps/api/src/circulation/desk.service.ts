import { Injectable, NotFoundException } from '@nestjs/common';
import type { DeskActivityDto, DeskMemberDto, DeskMemberMatchDto, DeskPickupDto, DeskTodayDto, FineDto } from '@mybook/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CirculationException } from './circulation.exception.js';
import { fineInclude, toFineDto } from './circulation.mapper.js';
import { CirculationService } from './circulation.service.js';
import { Clock } from './clock.js';
import { addDays, libraryDayStart } from './rules.js';

/** Circulation desk reads (member lookup, member overview) and fine handling. */
@Injectable()
export class DeskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circulation: CirculationService,
    private readonly clock: Clock,
  ) {}

  /**
   * Finds a member from whatever is scanned or typed at the desk: library card (MB00000001),
   * pickup code (MB-4K7Q), student number, e-mail or part of the name.
   */
  async lookup(q: string): Promise<DeskMemberMatchDto[]> {
    const term = q.trim();
    const select = { id: true, fullName: true, email: true, cardNumber: true, studentNumber: true };

    if (/^MB-[A-Z0-9]{4}$/i.test(term)) {
      const r = await this.prisma.reservation.findFirst({ where: { code: term.toUpperCase() }, select: { member: { select } } });
      return r ? [r.member] : [];
    }
    return this.prisma.profile.findMany({
      where: {
        OR: [
          { cardNumber: term.toUpperCase() },
          { studentNumber: term },
          { email: term.toLowerCase() },
          { fullName: { contains: term, mode: 'insensitive' } },
        ],
      },
      select,
      orderBy: { fullName: 'asc' },
      take: 10,
    });
  }

  async member(memberId: string): Promise<DeskMemberDto> {
    const profile = await this.prisma.profile.findUnique({ where: { id: memberId } });
    if (!profile) throw new NotFoundException('Member not found');
    const [standing, reservations, activeLoans, unpaidFines] = [
      await this.circulation.standing(memberId),
      await this.circulation.reservationsOf(memberId, true),
      await this.circulation.loansOf(memberId, true),
      await this.circulation.finesOf(memberId, true),
    ];
    return {
      id: profile.id,
      fullName: profile.fullName,
      email: profile.email,
      cardNumber: profile.cardNumber,
      studentNumber: profile.studentNumber,
      memberType: profile.memberType,
      faculty: profile.faculty,
      status: profile.status,
      standing,
      readyReservations: reservations.filter((r) => r.status === 'READY'),
      activeLoans,
      unpaidFines,
    };
  }

  /** The hold shelf today (waiting and collected pickup codes) and the latest checkouts and returns. */
  async today(recentLimit = 8): Promise<DeskTodayDto> {
    const now = this.clock.now();
    const dayStart = libraryDayStart(now);
    const tomorrow = addDays(dayStart, 1);

    const rows = await this.prisma.reservation.findMany({
      where: { OR: [{ status: 'READY' }, { status: 'FULFILLED', fulfilledAt: { gte: dayStart } }] },
      select: {
        code: true,
        status: true,
        expiresAt: true,
        fulfilledAt: true,
        member: { select: { id: true, fullName: true } },
        book: { select: { title: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const groups = new Map<string, DeskPickupDto>();
    for (const r of rows) {
      const key = `${r.code}:${r.member.id}`;
      const g = groups.get(key) ?? {
        code: r.code,
        memberId: r.member.id,
        memberName: r.member.fullName,
        books: [],
        status: 'COLLECTED',
        expiresAt: null,
        collectedAt: null,
      };
      g.books.push(r.book.title);
      if (r.status === 'READY') {
        g.status = 'READY';
        const at = r.expiresAt?.toISOString() ?? null;
        if (at && (!g.expiresAt || at < g.expiresAt)) g.expiresAt = at;
      } else {
        const at = r.fulfilledAt?.toISOString() ?? null;
        if (at && (!g.collectedAt || at > g.collectedAt)) g.collectedAt = at;
      }
      groups.set(key, g);
    }
    const pickups = [...groups.values()].sort((a, b) =>
      a.status !== b.status
        ? a.status === 'READY' ? -1 : 1
        : a.status === 'READY'
          ? (a.expiresAt ?? '').localeCompare(b.expiresAt ?? '')
          : (b.collectedAt ?? '').localeCompare(a.collectedAt ?? ''),
    );
    const expiringToday = pickups.filter((p) => p.status === 'READY' && p.expiresAt && new Date(p.expiresAt) < tomorrow).length;

    return { pickups, expiringToday, recent: await this.recent(recentLimit) };
  }

  /** Latest checkouts and returns from the audit log; a return that filled a hold adds a "hold" line. */
  private async recent(limit: number): Promise<DeskActivityDto[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: { action: { in: ['loan.checkout', 'loan.return'] } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const loans = await this.prisma.loan.findMany({
      where: { id: { in: logs.map((l) => l.entityId) } },
      select: { id: true, member: { select: { fullName: true } }, copy: { select: { bookId: true, book: { select: { title: true } } } } },
    });
    const byId = new Map(loans.map((l) => [l.id, l]));
    const data = (log: (typeof logs)[number]) => (log.data ?? {}) as { reservationCode?: string | null; holdFor?: string | null; fine?: number };

    const holdCodes = logs.map((l) => data(l).holdFor).filter((c): c is string => !!c);
    const holds = holdCodes.length
      ? await this.prisma.reservation.findMany({
          where: { code: { in: holdCodes } },
          select: { code: true, bookId: true, member: { select: { fullName: true } } },
        })
      : [];

    const out: DeskActivityDto[] = [];
    for (const log of logs) {
      const loan = byId.get(log.entityId);
      if (!loan) continue;
      const d = data(log);
      const base = { at: log.createdAt.toISOString(), bookTitle: loan.copy.book.title };
      if (log.action === 'loan.checkout') {
        out.push({ ...base, id: log.id, kind: 'out', memberName: loan.member.fullName, code: d.reservationCode ?? null, fine: null });
        continue;
      }
      const hold = d.holdFor ? holds.find((h) => h.code === d.holdFor && h.bookId === loan.copy.bookId) : undefined;
      if (hold) out.push({ ...base, id: `${log.id}:hold`, kind: 'hold', memberName: hold.member.fullName, code: hold.code, fine: null });
      out.push({ ...base, id: log.id, kind: 'in', memberName: loan.member.fullName, code: null, fine: d.fine ? Number(d.fine) : null });
    }
    return out.slice(0, limit);
  }

  async payFine(actor: AuthUser, fineId: string): Promise<FineDto> {
    return this.settleFine(actor, fineId, 'PAID', null);
  }

  async waiveFine(actor: AuthUser, fineId: string, note: string): Promise<FineDto> {
    return this.settleFine(actor, fineId, 'WAIVED', note);
  }

  private async settleFine(actor: AuthUser, fineId: string, status: 'PAID' | 'WAIVED', note: string | null): Promise<FineDto> {
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<{ status: string }[]>`SELECT status FROM fines WHERE id = ${fineId}::uuid FOR UPDATE`;
      if (!locked) throw new NotFoundException('Fine not found');
      if (locked.status !== 'UNPAID') throw new CirculationException('fine_not_unpaid');
      await tx.fine.update({
        where: { id: fineId },
        data: status === 'PAID' ? { status, paidAt: now } : { status, waivedById: actor.id, note },
      });
      await tx.auditLog.create({
        data: { actorId: actor.id, action: `fine.${status.toLowerCase()}`, entityType: 'fine', entityId: fineId, data: note ? { note } : undefined },
      });
    });
    return toFineDto(await this.prisma.fine.findUniqueOrThrow({ where: { id: fineId }, include: fineInclude }));
  }
}
