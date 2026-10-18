import { Injectable } from '@nestjs/common';
import type { DashboardDto, OverdueRowDto, PopularBookDto, ReportRange, ReportSummaryDto } from '@mybook/shared';
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

  /** B19: loans, on-time returns, readers and fines for a period, with monthly and category breakdowns. */
  async summary(range: ReportRange): Promise<ReportSummaryDto> {
    const now = this.clock.now();
    const from = reportStart(range, now);
    const before = new Date(from.getTime() - (now.getTime() - from.getTime()));

    const loans = await this.prisma.loan.count({ where: { checkedOutAt: { gte: from, lte: now } } });
    const loansBefore = await this.prisma.loan.count({ where: { checkedOutAt: { gte: before, lt: from } } });
    // The current period includes this moment; the one before ends where this one starts.
    const onTime = async (a: Date, b: Date, current: boolean) => {
      const returned = await this.prisma.loan.findMany({ where: { returnedAt: current ? { gte: a, lte: b } : { gte: a, lt: b } }, select: { dueAt: true, returnedAt: true } });
      return returned.length ? Math.round((returned.filter((l) => l.returnedAt! <= l.dueAt).length / returned.length) * 100) : null;
    };
    const readers = await this.prisma.loan.findMany({ where: { checkedOutAt: { gte: from, lte: now } }, distinct: ['memberId'], select: { memberId: true } });
    const paid = await this.prisma.fine.aggregate({ where: { status: 'PAID', paidAt: { gte: from, lte: now } }, _sum: { amount: true } });
    const waivedLogs = await this.prisma.auditLog.findMany({ where: { action: 'fine.waived', createdAt: { gte: from, lte: now } }, select: { entityId: true } });
    const waived = waivedLogs.length
      ? await this.prisma.fine.aggregate({ where: { id: { in: waivedLogs.map((l) => l.entityId) } }, _sum: { amount: true } })
      : { _sum: { amount: 0 } };

    return {
      range,
      from: from.toISOString(),
      to: now.toISOString(),
      loans,
      loansBefore,
      returnedOnTimePct: await onTime(from, now, true),
      returnedOnTimePctBefore: await onTime(before, from, false),
      activeReaders: readers.length,
      members: await this.prisma.profile.count(),
      finesCollected: Number(paid._sum.amount ?? 0),
      finesWaived: Number(waived._sum.amount ?? 0),
      months: await this.months(now),
      categories: await this.categories(from, now),
      topBooks: await this.topBooks(from, now),
    };
  }

  private async months(now: Date): Promise<ReportSummaryDto['months']> {
    const local = new Date(now.getTime() + 3 * 3_600_000);
    const monthKey = (offset: number) => {
      const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - offset, 1));
      return d.toISOString().slice(0, 7);
    };
    const since = libraryDayStart(new Date(`${monthKey(23)}-01T12:00:00Z`));
    const rows = await this.prisma.$queryRaw<{ month: string; count: bigint }[]>`
      SELECT to_char((checked_out_at AT TIME ZONE 'UTC') + interval '3 hours', 'YYYY-MM') AS month, count(*) AS count
      FROM loans WHERE checked_out_at >= ${since}
      GROUP BY 1`;
    const count = (key: string) => Number(rows.find((r) => r.month === key)?.count ?? 0);
    return Array.from({ length: 12 }, (_, i) => {
      const offset = 11 - i;
      return { month: monthKey(offset), loans: count(monthKey(offset)), previousYear: count(monthKey(offset + 12)) };
    });
  }

  private async categories(from: Date, to: Date): Promise<ReportSummaryDto['categories']> {
    const rows = await this.prisma.$queryRaw<{ category_id: string | null; loans: bigint }[]>`
      SELECT bc.category_id, count(*) AS loans
      FROM loans l
      JOIN book_copies c ON c.id = l.copy_id
      LEFT JOIN book_categories bc ON bc.book_id = c.book_id
      WHERE l.checked_out_at >= ${from} AND l.checked_out_at <= ${to}
      GROUP BY bc.category_id
      ORDER BY loans DESC`;
    const categories = await this.prisma.category.findMany({ where: { id: { in: rows.flatMap((r) => (r.category_id ? [r.category_id] : [])) } } });
    const byId = new Map(categories.map((c) => [c.id, c]));
    return rows.map((r) => {
      const c = r.category_id ? byId.get(r.category_id) : undefined;
      return { category: c ? { slug: c.slug, nameTr: c.nameTr, nameEn: c.nameEn } : null, loans: Number(r.loans) };
    });
  }

  private async topBooks(from: Date, to: Date, limit = 8): Promise<ReportSummaryDto['topBooks']> {
    const top = await this.prisma.$queryRaw<{ book_id: string; loans: bigint }[]>`
      SELECT c.book_id, count(*) AS loans
      FROM loans l JOIN book_copies c ON c.id = l.copy_id
      WHERE l.checked_out_at >= ${from} AND l.checked_out_at <= ${to}
      GROUP BY c.book_id
      ORDER BY loans DESC, c.book_id
      LIMIT ${limit}`;
    const books = await this.prisma.book.findMany({ where: { id: { in: top.map((t) => t.book_id) } }, include: bookInclude });
    const byId = new Map(books.map((b) => [b.id, b]));
    return top.map((t) => {
      const summary = toBookSummary(byId.get(t.book_id)!, this.supabase);
      return { book: summary, loans: Number(t.loans), copies: summary.availability.total };
    });
  }

  async overdue(): Promise<OverdueRowDto[]> {
    const now = this.clock.now();
    const settings = await this.prisma.$transaction((tx) => loadSettings(tx));
    const loans = await this.prisma.loan.findMany({
      where: { status: 'ACTIVE', dueAt: { lt: now } },
      include: {
        member: { select: { id: true, fullName: true, email: true, cardNumber: true, memberType: true } },
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
        memberType: l.member.memberType,
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

/** Where a report period starts, in library time: this week, this month, this term (Sep 1 / Feb 1) or the last 12 months. */
export function reportStart(range: ReportRange, now: Date): Date {
  const local = new Date(now.getTime() + 3 * 3_600_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const midnight = (year: number, month: number, day: number) => libraryDayStart(new Date(Date.UTC(year, month, day, 12)));
  switch (range) {
    case 'week':
      return libraryWeekStart(now);
    case 'month':
      return midnight(y, m, 1);
    case 'term':
      // Fall term from 1 September, spring term from 1 February.
      return m >= 8 ? midnight(y, 8, 1) : m >= 1 ? midnight(y, 1, 1) : midnight(y - 1, 8, 1);
    case 'year':
      return addDays(libraryDayStart(now), -365);
  }
}
