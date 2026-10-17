import { Injectable, NotFoundException } from '@nestjs/common';
import type { DeskMemberDto, FineDto } from '@mybook/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CirculationException } from './circulation.exception.js';
import { fineInclude, toFineDto } from './circulation.mapper.js';
import { CirculationService } from './circulation.service.js';
import { Clock } from './clock.js';

export interface DeskMemberMatch {
  id: string;
  fullName: string;
  email: string;
  cardNumber: string;
  studentNumber: string | null;
}

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
  async lookup(q: string): Promise<DeskMemberMatch[]> {
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
      status: profile.status,
      standing,
      readyReservations: reservations.filter((r) => r.status === 'READY'),
      activeLoans,
      unpaidFines,
    };
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
