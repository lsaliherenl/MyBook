import { Injectable } from '@nestjs/common';
import type { DashboardDto, OverdueRowDto, PopularBookDto } from '@mybook/shared';
import { bookInclude, toBookSummary } from '../catalog/book.mapper.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { Clock } from './clock.js';
import { loadSettings } from './holds.js';
import { addDays, daysOverdue, libraryDate, libraryDayStart, libraryWeekStart, overdueFine } from './rules.js';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly clock: Clock,
  ) {}

  async dashboard(weeks = 8): Promise<DashboardDto> {
    const now = this.clock.now();
    const since = addDays(now, -7 * weeks);
    const activeLoans = await this.prisma.loan.count({ where: { status: 'ACTIVE' } });
    const overdueLoans = await this.prisma.loan.count({ where: { status: 'ACTIVE', dueAt: { lt: now } } });
    const awaitingPickup = await this.prisma.reservation.count({ where: { status: 'READY' } });
    const waitingList = await this.prisma.reservation.count({ where: { status: 'PENDING' } });
    const newMembersThisWeek = await this.prisma.profile.count({ where: { createdAt: { gte: addDays(now, -7) } } });
    const unpaid = await this.prisma.fine.aggregate({ where: { status: 'UNPAID' }, _sum: { amount: true } });
    const perWeek = await this.prisma.$queryRaw<{ week: Date; count: bigint }[]>`
      SELECT date_trunc('week', checked_out_at) AS week, count(*) AS count
      FROM loans
      WHERE checked_out_at >= ${since}
      GROUP BY 1`;

    // Every week appears, including weeks without checkouts.
    const counts = new Map(perWeek.map((r) => [new Date(r.week).toISOString().slice(0, 10), Number(r.count)]));
    const monday = startOfIsoWeek(now);
    const loansPerWeek = Array.from({ length: weeks }, (_, i) => {
      const weekStart = addDays(monday, -7 * (weeks - 1 - i)).toISOString().slice(0, 10);
      return { weekStart, count: counts.get(weekStart) ?? 0 };
    });

    const weekAgo = addDays(now, -7);
    const activeLoansWeekAgo = await this.prisma.loan.count({
      where: { checkedOutAt: { lte: weekAgo }, OR: [{ status: 'ACTIVE' }, { returnedAt: { gt: weekAgo } }] },
    });
    const expiringToday = await this.prisma.reservation.count({
      where: { status: 'READY', expiresAt: { lt: addDays(libraryDayStart(now), 1) } },
    });
    const longOverdue = await this.prisma.loan.count({ where: { status: 'ACTIVE', dueAt: { lt: addDays(now, -14) } } });

    return {
      activeLoans,
      activeLoansWeekAgo,
      overdueLoans,
      awaitingPickup,
      expiringToday,
      waitingList,
      newMembersThisWeek,
      unpaidFinesTotal: Number(unpaid._sum.amount ?? 0),
      loansPerWeek,
      week: await this.week(now),
      membersOverLimit: await this.membersOverLimit(now),
      longestWaitlist: await this.longestWaitlist(),
      longOverdue,
    };
  }

  /** Checkouts and returns for each day of this week, Monday first, in library time. */
  private async week(now: Date): Promise<DashboardDto['week']> {
    const monday = libraryWeekStart(now);
    const rows = await this.prisma.$queryRaw<{ day: string; kind: string; count: bigint }[]>`
      SELECT to_char((checked_out_at AT TIME ZONE 'UTC') + interval '3 hours', 'YYYY-MM-DD') AS day, 'out' AS kind, count(*) AS count
      FROM loans WHERE checked_out_at >= ${monday}
      GROUP BY 1
      UNION ALL
      SELECT to_char((returned_at AT TIME ZONE 'UTC') + interval '3 hours', 'YYYY-MM-DD') AS day, 'in' AS kind, count(*) AS count
      FROM loans WHERE returned_at >= ${monday}
      GROUP BY 1`;
    const count = (day: string, kind: string) => Number(rows.find((r) => r.day === day && r.kind === kind)?.count ?? 0);
    return Array.from({ length: 7 }, (_, i) => {
      const date = libraryDate(addDays(monday, i));
      return { date, checkouts: count(date, 'out'), returns: count(date, 'in') };
    });
  }

  /** Members whose unpaid fines plus the fines their overdue loans are running up reach the limit. */
  private async membersOverLimit(now: Date): Promise<DashboardDto['membersOverLimit']> {
    const settings = await this.prisma.$transaction((tx) => loadSettings(tx));
    const limit = settings.fineBlockThreshold;
    if (limit <= 0) return { count: 0, limit, names: [] };

    const totals = new Map<string, number>();
    const unpaid = await this.prisma.fine.groupBy({ by: ['memberId'], where: { status: 'UNPAID' }, _sum: { amount: true } });
    for (const f of unpaid) totals.set(f.memberId, Number(f._sum.amount ?? 0));
    const overdue = await this.prisma.loan.findMany({ where: { status: 'ACTIVE', dueAt: { lt: now } }, select: { memberId: true, dueAt: true } });
    for (const l of overdue) {
      totals.set(l.memberId, (totals.get(l.memberId) ?? 0) + overdueFine(daysOverdue(l.dueAt, now), settings.finePerDay));
    }

    const over = [...totals].filter(([, total]) => total >= limit).sort((a, b) => b[1] - a[1]);
    const profiles = await this.prisma.profile.findMany({ where: { id: { in: over.slice(0, 3).map(([id]) => id) } }, select: { id: true, fullName: true } });
    const names = over.slice(0, 3).map(([id]) => profiles.find((p) => p.id === id)?.fullName ?? '');
    return { count: over.length, limit, names };
  }

  private async longestWaitlist(): Promise<DashboardDto['longestWaitlist']> {
    const [top] = await this.prisma.reservation.groupBy({
      by: ['bookId'],
      where: { status: 'PENDING' },
      _count: { bookId: true },
      orderBy: { _count: { bookId: 'desc' } },
      take: 1,
    });
    if (!top) return null;
    const book = await this.prisma.book.findUniqueOrThrow({ where: { id: top.bookId }, select: { title: true, slug: true } });
    return { title: book.title, slug: book.slug, waiting: top._count.bookId };
  }

  async overdue(): Promise<OverdueRowDto[]> {
    const now = this.clock.now();
    const settings = await this.prisma.$transaction((tx) => loadSettings(tx));
    const loans = await this.prisma.loan.findMany({
      where: { status: 'ACTIVE', dueAt: { lt: now } },
      include: {
        member: { select: { id: true, fullName: true, email: true, cardNumber: true } },
        copy: { select: { barcode: true, book: { select: { title: true } } } },
      },
      orderBy: { dueAt: 'asc' },
    });
    return loans.map((l) => {
      const days = daysOverdue(l.dueAt, now);
      return {
        loanId: l.id,
        memberId: l.member.id,
        memberName: l.member.fullName,
        memberEmail: l.member.email,
        cardNumber: l.member.cardNumber,
        bookTitle: l.copy.book.title,
        copyBarcode: l.copy.barcode,
        dueAt: l.dueAt.toISOString(),
        daysOverdue: days,
        accruedFine: overdueFine(days, settings.finePerDay),
      };
    });
  }

  /** The overdue report as CSV (UTF-8 with BOM so Excel shows Turkish letters correctly). */
  async overdueCsv(): Promise<string> {
    const header = ['member', 'email', 'card', 'book', 'barcode', 'due_at', 'days_overdue', 'accrued_fine_try'];
    const rows = (await this.overdue()).map((r) => [
      r.memberName,
      r.memberEmail,
      r.cardNumber,
      r.bookTitle,
      r.copyBarcode,
      r.dueAt,
      String(r.daysOverdue),
      r.accruedFine.toFixed(2),
    ]);
    const escape = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    return '﻿' + [header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n') + '\r\n';
  }

  async popular(days = 90, limit = 10): Promise<PopularBookDto[]> {
    const since = addDays(this.clock.now(), -days);
    const top = await this.prisma.$queryRaw<{ book_id: string; loans: bigint }[]>`
      SELECT c.book_id, count(*) AS loans
      FROM loans l JOIN book_copies c ON c.id = l.copy_id
      WHERE l.checked_out_at >= ${since}
      GROUP BY c.book_id
      ORDER BY loans DESC
      LIMIT ${limit}`;
    const books = await this.prisma.book.findMany({ where: { id: { in: top.map((t) => t.book_id) } }, include: bookInclude });
    const byId = new Map(books.map((b) => [b.id, b]));
    return top.map((t) => ({ book: toBookSummary(byId.get(t.book_id)!, this.supabase), loans: Number(t.loans) }));
  }
}

function startOfIsoWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
}
