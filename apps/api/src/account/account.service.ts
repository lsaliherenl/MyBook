import { ConflictException, Injectable } from '@nestjs/common';
import type { ReadingYearDto } from '@mybook/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CirculationService } from '../circulation/circulation.service.js';
import { Clock } from '../circulation/clock.js';
import { toProfileDto } from '../me/profile.mapper.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { ListsService } from './lists.service.js';

/** Istanbul is UTC+3 all year; the year and month a book was returned are counted there. */
const OFFSET_MS = 3 * 60 * 60 * 1000;
const localYear = (d: Date) => new Date(d.getTime() + OFFSET_MS).getUTCFullYear();
const localMonth = (d: Date) => new Date(d.getTime() + OFFSET_MS).getUTCMonth();

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly circulation: CirculationService,
    private readonly lists: ListsService,
    private readonly clock: Clock,
  ) {}

  /** "You read 23 books in 2026": returned loans of a year with a few totals. */
  async readingYear(memberId: string, requested?: number): Promise<ReadingYearDto> {
    const thisYear = localYear(this.clock.now());
    const year = requested ?? thisYear;
    const history = (await this.circulation.loansOf(memberId, false)).filter((l) => l.returnedAt);
    const yearOf = (l: (typeof history)[number]) => localYear(new Date(l.returnedAt!));
    const loans = history.filter((l) => yearOf(l) === year);

    const books = await this.prisma.book.findMany({
      where: { id: { in: [...new Set(loans.map((l) => l.book.id))] } },
      select: { id: true, pageCount: true, categories: { select: { category: true } }, authors: { select: { author: { select: { name: true } } } } },
    });
    const byId = new Map(books.map((b) => [b.id, b]));

    const perMonth = Array.from({ length: 12 }, () => 0);
    const categories = new Map<string, { slug: string; nameTr: string; nameEn: string; count: number }>();
    const authors = new Map<string, number>();
    let pages = 0;
    for (const loan of loans) {
      perMonth[localMonth(new Date(loan.returnedAt!))]++;
      const book = byId.get(loan.book.id);
      pages += book?.pageCount ?? 0;
      for (const { category: c } of book?.categories ?? []) {
        const entry = categories.get(c.slug) ?? { slug: c.slug, nameTr: c.nameTr, nameEn: c.nameEn, count: 0 };
        entry.count++;
        categories.set(c.slug, entry);
      }
      for (const { author } of book?.authors ?? []) authors.set(author.name, (authors.get(author.name) ?? 0) + 1);
    }
    const topAuthor = [...authors.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      year,
      years: [...new Set([thisYear, ...history.map(yearOf)])].sort((a, b) => b - a),
      books: loans.length,
      previousYearBooks: history.filter((l) => yearOf(l) === year - 1).length,
      pages,
      topCategory: [...categories.values()].sort((a, b) => b.count - a.count)[0] ?? null,
      topAuthor: topAuthor ? { name: topAuthor[0], count: topAuthor[1] } : null,
      perMonth,
      loans: loans.sort((a, b) => b.returnedAt!.localeCompare(a.returnedAt!)),
    };
  }

  /** Everything we hold about the member, for the KVKK "download my data" button. */
  async exportData(memberId: string) {
    const [profile, loans, reservations, fines, lists, events] = await Promise.all([
      this.prisma.profile.findUniqueOrThrow({ where: { id: memberId } }),
      this.circulation.loansOf(memberId),
      this.circulation.reservationsOf(memberId),
      this.circulation.finesOf(memberId),
      this.lists.all(memberId),
      this.prisma.eventRegistration.findMany({ where: { memberId }, include: { event: { select: { slug: true, titleEn: true, startsAt: true } } } }),
    ]);
    const listDetails = await Promise.all(lists.map((l) => this.lists.detail(memberId, l.id)));
    const book = (b: { title: string; authors: { name: string }[]; slug: string }) => ({ title: b.title, authors: b.authors.map((a) => a.name), slug: b.slug });
    return {
      exportedAt: this.clock.now().toISOString(),
      profile: toProfileDto(profile),
      loans: loans.map((l) => ({ book: book(l.book), copy: l.copyBarcode, checkedOutAt: l.checkedOutAt, dueAt: l.dueAt, returnedAt: l.returnedAt, status: l.status })),
      reservations: reservations.map((r) => ({ code: r.code, book: book(r.book), status: r.status, createdAt: r.createdAt, closedAt: r.closedAt })),
      fines: fines.map((f) => ({ book: f.bookTitle, reason: f.reason, amount: f.amount, status: f.status, issuedAt: f.issuedAt, paidAt: f.paidAt })),
      lists: listDetails.map((l) => ({ name: l.name || 'Favorites', books: l.books.map(book) })),
      events: events.map((e) => ({ event: e.event.slug, title: e.event.titleEn, startsAt: e.event.startsAt, waitlisted: e.waitlisted })),
    };
  }

  /**
   * Closes the account once nothing is outstanding. Loan and fine records must stay for the library's books,
   * so the profile is anonymised and the sign-in is disabled rather than deleted.
   */
  async close(user: AuthUser): Promise<void> {
    const [loans, reservations, fines] = await Promise.all([
      this.prisma.loan.count({ where: { memberId: user.id, status: 'ACTIVE' } }),
      this.prisma.reservation.count({ where: { memberId: user.id, status: { in: ['PENDING', 'READY'] } } }),
      this.prisma.fine.count({ where: { memberId: user.id, status: 'UNPAID' } }),
    ]);
    if (loans || reservations || fines) throw new ConflictException({ code: 'account_has_open_items', loans, reservations, fines });

    const email = `closed-${user.id}@mybook.invalid`;
    const { error } = await this.supabase.client.auth.admin.updateUserById(user.id, {
      email,
      email_confirm: true,
      ban_duration: '876000h',
      user_metadata: {},
    });
    if (error) throw new Error(`Could not close the sign-in: ${error.message}`);

    await this.prisma.$transaction([
      this.prisma.favorite.deleteMany({ where: { memberId: user.id } }),
      this.prisma.readingList.deleteMany({ where: { memberId: user.id } }),
      this.prisma.eventRegistration.deleteMany({ where: { memberId: user.id } }),
      this.prisma.profile.update({
        where: { id: user.id },
        data: {
          email,
          fullName: 'Closed account',
          studentNumber: null,
          phone: null,
          faculty: null,
          avatarUrl: null,
          status: 'BLOCKED',
          blockedReason: 'Closed by the member',
          notificationPrefs: {},
        },
      }),
      this.prisma.auditLog.create({ data: { actorId: user.id, action: 'account.close', entityType: 'profile', entityId: user.id } }),
    ]);
  }
}
