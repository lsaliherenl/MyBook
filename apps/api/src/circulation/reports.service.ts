import { Injectable } from '@nestjs/common';
import type { DashboardDto, OverdueRowDto, PopularBookDto } from '@mybook/shared';
import { bookInclude, toBookSummary } from '../catalog/book.mapper.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { Clock } from './clock.js';
import { loadSettings } from './holds.js';
import { addDays, daysOverdue, overdueFine } from './rules.js';

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

    return {
      activeLoans,
      overdueLoans,
      awaitingPickup,
      waitingList,
      newMembersThisWeek,
      unpaidFinesTotal: Number(unpaid._sum.amount ?? 0),
      loansPerWeek,
    };
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
