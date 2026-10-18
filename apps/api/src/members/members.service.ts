import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminMemberDto,
  AdminMemberFilter,
  AdminMemberListDto,
  AdminMembersQuery,
  MemberHistoryItemDto,
  MemberNoteDto,
} from '@mybook/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CirculationService } from '../circulation/circulation.service.js';
import { Clock } from '../circulation/clock.js';
import { loadSettings } from '../circulation/holds.js';
import { addDays, daysOverdue, libraryDayStart, overdueFine } from '../circulation/rules.js';
import { Prisma } from '../generated/prisma/client.js';
import { toProfileDto } from '../me/profile.mapper.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface StatsRow {
  id: string;
  active: bigint;
  overdue: bigint;
  unpaid: Prisma.Decimal | number | string;
  last_activity: Date | null;
}

/** Librarian views of members: the member table (B17) and one member's whole record. */
@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circulation: CirculationService,
    private readonly clock: Clock,
  ) {}

  async list(query: AdminMembersQuery): Promise<AdminMemberListDto> {
    const now = this.clock.now();
    const settings = await this.prisma.$transaction((tx) => loadSettings(tx));
    const q = query.q?.trim();
    const search = q
      ? Prisma.sql`WHERE (p.full_name ILIKE ${`%${q}%`} OR p.email ILIKE ${`%${q}%`} OR p.student_number LIKE ${`${q}%`} OR p.card_number = ${q.toUpperCase()})`
      : Prisma.empty;
    const stats = (where: Prisma.Sql) => Prisma.sql`
      SELECT p.id, p.full_name, p.member_type, p.status,
        (SELECT count(*) FROM loans l WHERE l.member_id = p.id AND l.status = 'ACTIVE') AS active,
        (SELECT count(*) FROM loans l WHERE l.member_id = p.id AND l.status = 'ACTIVE' AND l.due_at < ${now}) AS overdue,
        (SELECT coalesce(sum(f.amount), 0) FROM fines f WHERE f.member_id = p.id AND f.status = 'UNPAID') AS unpaid,
        greatest(
          (SELECT max(l.checked_out_at) FROM loans l WHERE l.member_id = p.id),
          (SELECT max(l.returned_at) FROM loans l WHERE l.member_id = p.id),
          (SELECT max(r.created_at) FROM reservations r WHERE r.member_id = p.id)
        ) AS last_activity
      FROM profiles p
      ${where}`;
    const filters: Record<AdminMemberFilter, Prisma.Sql> = {
      all: Prisma.sql`TRUE`,
      STUDENT: Prisma.sql`member_type = 'STUDENT'`,
      ACADEMIC: Prisma.sql`member_type = 'ACADEMIC'`,
      STAFF: Prisma.sql`member_type = 'STAFF'`,
      overdue: Prisma.sql`overdue > 0`,
      blocked: Prisma.sql`status = 'BLOCKED'`,
    };
    const countsSql = (where: Prisma.Sql) => Prisma.sql`
      WITH s AS (${stats(where)})
      SELECT count(*) AS "all",
        count(*) FILTER (WHERE ${filters.STUDENT}) AS "STUDENT",
        count(*) FILTER (WHERE ${filters.ACADEMIC}) AS "ACADEMIC",
        count(*) FILTER (WHERE ${filters.STAFF}) AS "STAFF",
        count(*) FILTER (WHERE ${filters.overdue}) AS overdue,
        count(*) FILTER (WHERE ${filters.blocked}) AS blocked,
        count(*) FILTER (WHERE active > 0) AS borrowing
      FROM s`;

    const [counts] = await this.prisma.$queryRaw<Record<AdminMemberFilter | 'borrowing', bigint>[]>(countsSql(search));
    const [everyone] = q ? await this.prisma.$queryRaw<Record<AdminMemberFilter | 'borrowing', bigint>[]>(countsSql(Prisma.empty)) : [counts];
    const rows = await this.prisma.$queryRaw<StatsRow[]>`
      WITH s AS (${stats(search)})
      SELECT id, active, overdue, unpaid, last_activity FROM s
      WHERE ${filters[query.filter]}
      ORDER BY full_name, id
      LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`;

    const profiles = await this.prisma.profile.findMany({ where: { id: { in: rows.map((r) => r.id) } } });
    const overdueLoans = await this.prisma.loan.findMany({
      where: { memberId: { in: rows.map((r) => r.id) }, status: 'ACTIVE', dueAt: { lt: now } },
      select: { memberId: true, dueAt: true },
    });
    const byId = new Map(profiles.map((p) => [p.id, p]));
    const newThisMonth = await this.prisma.profile.count({ where: { createdAt: { gte: addDays(now, -30) } } });

    return {
      items: rows.map((r) => {
        const p = byId.get(r.id)!;
        const accrued = overdueLoans
          .filter((l) => l.memberId === r.id)
          .reduce((sum, l) => sum + overdueFine(daysOverdue(l.dueAt, now), settings.finePerDay), 0);
        return {
          id: p.id,
          fullName: p.fullName,
          email: p.email,
          cardNumber: p.cardNumber,
          studentNumber: p.studentNumber,
          memberType: p.memberType,
          faculty: p.faculty,
          role: p.role,
          status: p.status,
          activeLoans: Number(r.active),
          overdueLoans: Number(r.overdue),
          fines: Math.round((Number(r.unpaid) + accrued) * 100) / 100,
          lastActivityAt: r.last_activity ? new Date(r.last_activity).toISOString() : null,
        };
      }),
      total: Number(counts[query.filter]),
      page: query.page,
      pageSize: query.pageSize,
      counts: {
        all: Number(counts.all),
        STUDENT: Number(counts.STUDENT),
        ACADEMIC: Number(counts.ACADEMIC),
        STAFF: Number(counts.STAFF),
        overdue: Number(counts.overdue),
        blocked: Number(counts.blocked),
      },
      kpis: {
        members: Number(everyone.all),
        newThisMonth,
        borrowing: Number(everyone.borrowing),
        blocked: Number(everyone.blocked),
        withOverdue: Number(everyone.overdue),
      },
      maxActiveLoans: settings.maxActiveLoans,
      fineBlockThreshold: settings.fineBlockThreshold,
    };
  }

  /** The members table as CSV (UTF-8 with BOM so Excel shows Turkish letters). */
  async listCsv(query: AdminMembersQuery): Promise<string> {
    const rows: AdminMemberListDto['items'] = [];
    for (let page = 1; ; page++) {
      const result = await this.list({ ...query, page, pageSize: 100 });
      rows.push(...result.items);
      if (rows.length >= result.total || result.items.length === 0) break;
    }
    const header = ['name', 'email', 'card', 'student_number', 'type', 'faculty', 'status', 'active_loans', 'overdue_loans', 'fines_try', 'last_activity'];
    const lines = rows.map((r) => [
      r.fullName,
      r.email,
      r.cardNumber,
      r.studentNumber ?? '',
      r.memberType,
      r.faculty ?? '',
      r.status,
      String(r.activeLoans),
      String(r.overdueLoans),
      r.fines.toFixed(2),
      r.lastActivityAt ?? '',
    ]);
    const escape = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    return '﻿' + [header, ...lines].map((line) => line.map(escape).join(',')).join('\r\n') + '\r\n';
  }

  async get(memberId: string): Promise<AdminMemberDto> {
    const profile = await this.prisma.profile.findUnique({ where: { id: memberId } });
    if (!profile) throw new NotFoundException('Member not found');
    const now = this.clock.now();

    const standing = await this.circulation.standing(memberId);
    const loans = await this.circulation.loansOf(memberId, true);
    const reservations = await this.circulation.reservationsOf(memberId, true);
    const fines = (await this.circulation.finesOf(memberId)).slice(0, 20);

    // Library time: the year starts at local midnight on 1 January.
    const year = new Date(libraryDayStart(now).getTime() + 3 * 3_600_000).getUTCFullYear();
    const yearStart = libraryDayStart(new Date(Date.UTC(year, 0, 1, 12)));
    const borrowed = await this.prisma.loan.count({ where: { memberId, checkedOutAt: { gte: yearStart } } });
    const returned = await this.prisma.loan.findMany({ where: { memberId, returnedAt: { gte: yearStart } }, select: { dueAt: true, returnedAt: true } });
    const onTime = returned.filter((l) => l.returnedAt! <= l.dueAt).length;

    return {
      profile: toProfileDto(profile),
      blockedReason: profile.blockedReason,
      standing,
      loans,
      reservations,
      fines,
      accruingFines: Math.round(loans.filter((l) => l.daysOverdue > 0).reduce((sum, l) => sum + l.fineAmount, 0) * 100) / 100,
      year: { year, borrowed, returnedOnTimePct: returned.length ? Math.round((onTime / returned.length) * 100) : null },
      history: await this.history(memberId, now),
      notes: await this.notes(memberId),
    };
  }

  async addNote(actor: AuthUser, memberId: string, text: string): Promise<MemberNoteDto[]> {
    if (!(await this.prisma.profile.findUnique({ where: { id: memberId }, select: { id: true } }))) throw new NotFoundException('Member not found');
    await this.prisma.auditLog.create({ data: { actorId: actor.id, action: 'member.note', entityType: 'profile', entityId: memberId, data: { text } } });
    return this.notes(memberId);
  }

  private async notes(memberId: string): Promise<MemberNoteDto[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { entityType: 'profile', entityId: memberId, action: 'member.note' },
      include: { actor: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map((n) => ({ id: n.id, text: String((n.data as { text?: string } | null)?.text ?? ''), author: n.actor?.fullName ?? null, at: n.createdAt.toISOString() }));
  }

  /** The member's recent story: loans, reservations and blocks, newest first. */
  private async history(memberId: string, now: Date, limit = 30): Promise<MemberHistoryItemDto[]> {
    const loans = await this.prisma.loan.findMany({
      where: { memberId },
      orderBy: { checkedOutAt: 'desc' },
      take: limit,
      include: { copy: { select: { book: { select: { title: true } } } }, reservation: { select: { code: true } }, fines: { select: { amount: true } } },
    });
    const reservations = await this.prisma.reservation.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { book: { select: { title: true } } },
    });
    const blocks = await this.prisma.auditLog.findMany({
      where: { entityType: 'profile', entityId: memberId, action: 'member.status' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const items: MemberHistoryItemDto[] = [];
    const item = (at: Date, kind: MemberHistoryItemDto['kind'], bookTitle: string | null, extra: Partial<MemberHistoryItemDto> = {}) =>
      items.push({ at: at.toISOString(), kind, bookTitle, code: null, daysLate: 0, fine: null, ...extra });

    for (const l of loans) {
      const title = l.copy.book.title;
      if (l.reservation) item(l.checkedOutAt, 'collected', title, { code: l.reservation.code });
      else item(l.checkedOutAt, 'borrowed', title);
      if (l.returnedAt) {
        const fine = l.fines.reduce((sum, f) => sum + Number(f.amount), 0);
        item(l.returnedAt, 'returned', title, { daysLate: daysOverdue(l.dueAt, l.returnedAt), fine: fine || null });
      }
    }
    for (const r of reservations) {
      item(r.createdAt, 'reserved', r.book.title, { code: r.code });
      if (r.status === 'EXPIRED' && r.expiresAt && r.expiresAt <= now) item(r.expiresAt, 'expired', r.book.title, { code: r.code });
      if (r.status === 'CANCELLED' && r.cancelledAt) item(r.cancelledAt, 'cancelled', r.book.title, { code: r.code });
    }
    for (const b of blocks) {
      const blocked = (b.data as { status?: string } | null)?.status === 'BLOCKED';
      item(b.createdAt, blocked ? 'blocked' : 'unblocked', null);
    }
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  }
}
