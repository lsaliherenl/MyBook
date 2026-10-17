/**
 * Circulation against a real Postgres (PGlite) with every migration applied, so the database
 * constraints and the service rules are tested together. Time is driven by a fake clock.
 */
import type { CirculationError } from '@mybook/shared';
import { createBook, createMember, createTestDb, type TestDb } from '../../test/support/test-db.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { CirculationService } from './circulation.service.js';
import { Clock } from './clock.js';
import { DeskService } from './desk.service.js';
import { ReportsService } from './reports.service.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

class FakeClock extends Clock {
  current = new Date('2026-10-01T09:00:00Z');
  override now() {
    return new Date(this.current);
  }
  advance(ms: number) {
    this.current = new Date(this.current.getTime() + ms);
  }
}

const supabase = { publicUrl: (_bucket: string, path: string) => `https://storage.test/${path}` } as unknown as SupabaseService;

let db: TestDb;
let clock: FakeClock;
let circulation: CirculationService;
let desk: DeskService;
let reports: ReportsService;
let librarian: AuthUser;

const asUser = (p: { id: string; email: string; role: AuthUser['role']; status: AuthUser['status'] }): AuthUser => ({
  id: p.id,
  email: p.email,
  role: p.role,
  status: p.status,
});

async function newMember() {
  return asUser(await createMember(db));
}

async function expectRefused(promise: Promise<unknown>, code: CirculationError) {
  await expect(promise).rejects.toMatchObject({ code });
}

beforeEach(async () => {
  db = await createTestDb();
  clock = new FakeClock();
  const prisma = db.prisma as unknown as PrismaService;
  circulation = new CirculationService(prisma, supabase, clock);
  desk = new DeskService(prisma, circulation, clock);
  reports = new ReportsService(prisma, supabase, clock);
  librarian = asUser(await createMember(db, { role: 'LIBRARIAN', name: 'Mehmet Demir' }));
});

afterEach(() => db.close());

describe('reservations', () => {
  it('holds a shelf copy right away and starts the 48-hour pickup window', async () => {
    const ayse = await newMember();
    const book = await createBook(db, 'Kürk Mantolu Madonna', 2);

    const [r] = await circulation.reserve(ayse, [book.id]);

    expect(r.status).toBe('READY');
    expect(r.code).toMatch(/^MB-[A-Z2-9]{4}$/);
    expect(r.copyBarcode).toBe(book.copies[0].barcode);
    expect(r.expiresAt).toBe(new Date(clock.current.getTime() + 48 * HOUR).toISOString());
    const copy = await db.prisma.bookCopy.findUniqueOrThrow({ where: { id: book.copies[0].id } });
    expect(copy.status).toBe('ON_HOLD');
  });

  it('gives books reserved together one pickup code, and the desk finds the member by it', async () => {
    const ayse = await newMember();
    const [a, b] = [await createBook(db, 'Huzur', 1), await createBook(db, 'Aylak Adam', 1)];

    const reservations = await circulation.reserve(ayse, [a.id, b.id]);

    expect(new Set(reservations.map((r) => r.code)).size).toBe(1);
    const found = await desk.lookup(reservations[0].code);
    expect(found.map((m) => m.id)).toEqual([ayse.id]);
  });

  it('queues readers when every copy is taken', async () => {
    const [a, b, c] = [await newMember(), await newMember(), await newMember()];
    const book = await createBook(db, 'Tutunamayanlar', 1);

    expect((await circulation.reserve(a, [book.id]))[0].status).toBe('READY');
    const [rb] = await circulation.reserve(b, [book.id]);
    clock.advance(1000);
    const [rc] = await circulation.reserve(c, [book.id]);

    expect(rb).toMatchObject({ status: 'PENDING', queuePosition: 1 });
    expect(rc).toMatchObject({ status: 'PENDING', queuePosition: 2 });
  });

  it('refuses a second reservation for the same title and anything beyond the loan limit', async () => {
    const ayse = await newMember();
    const books = await Promise.all(Array.from({ length: 6 }, (_, i) => createBook(db, `Book ${i}`)));

    await circulation.reserve(ayse, [books[0].id]);
    await expectRefused(circulation.reserve(ayse, [books[0].id]), 'already_reserved');
    await expectRefused(circulation.reserve(ayse, books.slice(1).map((b) => b.id)), 'loan_limit_reached');
    // All or nothing: the failed batch reserved none of its books.
    expect(await db.prisma.reservation.count({ where: { memberId: ayse.id } })).toBe(1);
  });

  it('refuses titles without circulating copies', async () => {
    const ayse = await newMember();
    const book = await createBook(db, 'Lost in the stacks', 1);
    await db.prisma.bookCopy.update({ where: { id: book.copies[0].id }, data: { status: 'LOST' } });
    await expectRefused(circulation.reserve(ayse, [book.id]), 'no_copies');
  });

  it('cancelling a held reservation passes the copy to the next reader', async () => {
    const [a, b] = [await newMember(), await newMember()];
    const book = await createBook(db, 'Saatleri Ayarlama Enstitüsü', 1);
    const [ra] = await circulation.reserve(a, [book.id]);
    await circulation.reserve(b, [book.id]);

    await circulation.cancelReservation(a, ra.id);

    const [rb] = await circulation.reservationsOf(b.id);
    expect(rb).toMatchObject({ status: 'READY', copyBarcode: book.copies[0].barcode });
  });

  it('members cannot cancel other members’ reservations', async () => {
    const [a, b] = [await newMember(), await newMember()];
    const book = await createBook(db);
    const [ra] = await circulation.reserve(a, [book.id]);
    await expectRefused(circulation.cancelReservation(b, ra.id), 'reservation_not_found');
    await expect(circulation.cancelReservation(librarian, ra.id)).resolves.toMatchObject({ status: 'CANCELLED' });
  });

  it('expires uncollected holds and moves the copy on', async () => {
    const [a, b] = [await newMember(), await newMember()];
    const book = await createBook(db, 'İnce Memed', 1);
    await circulation.reserve(a, [book.id]);
    await circulation.reserve(b, [book.id]);

    clock.advance(47 * HOUR);
    expect(await circulation.expireHolds()).toBe(0);
    clock.advance(2 * HOUR);
    expect(await circulation.expireHolds()).toBe(1);

    expect((await circulation.reservationsOf(a.id))[0].status).toBe('EXPIRED');
    expect((await circulation.reservationsOf(b.id))[0].status).toBe('READY');
  });
});

describe('desk checkout and return', () => {
  it('turns a ready reservation into a 14-day loan', async () => {
    const ayse = await newMember();
    const book = await createBook(db, 'Masumiyet Müzesi', 1);
    const [r] = await circulation.reserve(ayse, [book.id]);

    const { loan, reservationCode } = await circulation.checkout(librarian, ayse.id, book.copies[0].barcode);

    expect(reservationCode).toBe(r.code);
    expect(loan.dueAt).toBe(new Date(clock.current.getTime() + 14 * DAY).toISOString());
    expect((await circulation.reservationsOf(ayse.id))[0].status).toBe('FULFILLED');
    expect((await db.prisma.bookCopy.findUniqueOrThrow({ where: { id: book.copies[0].id } })).status).toBe('ON_LOAN');
  });

  it('will not hand a held copy to someone else', async () => {
    const [a, b] = [await newMember(), await newMember()];
    const book = await createBook(db, 'Simyacı', 1);
    await circulation.reserve(a, [book.id]);
    await expectRefused(circulation.checkout(librarian, b.id, book.copies[0].barcode), 'copy_reserved_for_another');
  });

  it('lends a shelf copy to a walk-in reader, but not a copy already out', async () => {
    const [a, b] = [await newMember(), await newMember()];
    const book = await createBook(db, 'Dune', 1);
    await circulation.checkout(librarian, a.id, book.copies[0].barcode);
    await expectRefused(circulation.checkout(librarian, b.id, book.copies[0].barcode), 'copy_on_loan');
    await expectRefused(circulation.checkout(librarian, b.id, 'BK9999999'), 'copy_not_found');
  });

  it('a member collecting with a different copy frees the one held for them', async () => {
    const [a, b] = [await newMember(), await newMember()];
    const book = await createBook(db, 'Huzur', 2);
    const [ra] = await circulation.reserve(a, [book.id]); // holds copy 1
    await circulation.checkout(librarian, a.id, book.copies[1].barcode); // walks out with copy 2

    expect((await circulation.reservationsOf(a.id))[0]).toMatchObject({ id: ra.id, status: 'FULFILLED' });
    expect((await db.prisma.bookCopy.findUniqueOrThrow({ where: { id: book.copies[0].id } })).status).toBe('AVAILABLE');
    // …so the next reader gets copy 1 immediately.
    expect((await circulation.reserve(b, [book.id]))[0].status).toBe('READY');
  });

  it('charges a fine for late returns and routes the copy to the next reader', async () => {
    const [a, b] = [await newMember(), await newMember()];
    const book = await createBook(db, 'Kuyucaklı Yusuf', 1);
    await circulation.checkout(librarian, a.id, book.copies[0].barcode);
    await circulation.reserve(b, [book.id]);

    clock.advance(14 * DAY + 3 * DAY - HOUR); // 3 started days late
    const result = await circulation.returnCopy(librarian, book.copies[0].barcode);

    expect(result.loan).toMatchObject({ status: 'RETURNED', daysOverdue: 3, fineAmount: 7.5 });
    expect(result.fine).toMatchObject({ reason: 'OVERDUE', amount: 7.5, status: 'UNPAID' });
    expect(result.holdFor).toMatchObject({ memberName: 'Ayşe Yılmaz' });
    expect((await circulation.reservationsOf(b.id))[0].status).toBe('READY');
  });

  it('an on-time return goes back to the shelf without a fine', async () => {
    const ayse = await newMember();
    const book = await createBook(db, 'Aylak Adam', 1);
    await circulation.checkout(librarian, ayse.id, book.copies[0].barcode);
    clock.advance(10 * DAY);

    const result = await circulation.returnCopy(librarian, book.copies[0].barcode);

    expect(result.fine).toBeNull();
    expect(result.holdFor).toBeNull();
    expect((await db.prisma.bookCopy.findUniqueOrThrow({ where: { id: book.copies[0].id } })).status).toBe('AVAILABLE');
    await expectRefused(circulation.returnCopy(librarian, book.copies[0].barcode), 'copy_not_on_loan');
  });
});

describe('renewals', () => {
  it('extends once, and not when someone is waiting or the loan is overdue', async () => {
    const [a, b] = [await newMember(), await newMember()];
    const [one, two] = [await createBook(db, 'Gece', 1), await createBook(db, 'Semaver', 1)];
    const first = (await circulation.checkout(librarian, a.id, one.copies[0].barcode)).loan;
    const second = (await circulation.checkout(librarian, a.id, two.copies[0].barcode)).loan;

    const renewed = await circulation.renew(a, first.id);
    expect(renewed.dueAt).toBe(new Date(new Date(first.dueAt).getTime() + 14 * DAY).toISOString());
    await expectRefused(circulation.renew(a, first.id), 'renewal_limit_reached');

    await circulation.reserve(b, [two.id]);
    await expectRefused(circulation.renew(a, second.id), 'book_has_waiting_list');

    clock.advance(30 * DAY);
    await expectRefused(circulation.renew(a, first.id), 'loan_overdue');
    await expectRefused(circulation.renew(b, first.id), 'loan_not_found');
  });
});

describe('member standing', () => {
  it('an overdue loan blocks new reservations', async () => {
    const ayse = await newMember();
    const [lent, wanted] = [await createBook(db, 'Yaban', 1), await createBook(db, 'Eylül', 1)];
    await circulation.checkout(librarian, ayse.id, lent.copies[0].barcode);
    clock.advance(15 * DAY);

    await expectRefused(circulation.reserve(ayse, [wanted.id]), 'loan_overdue');
    expect(await circulation.standing(ayse.id)).toMatchObject({ canBorrow: false, blockedReason: 'loan_overdue' });
  });

  it('unpaid fines over the threshold block borrowing until they are paid', async () => {
    const ayse = await newMember();
    const [lent, wanted] = [await createBook(db, 'Çalıkuşu', 1), await createBook(db, 'Sinekli Bakkal', 1)];
    await circulation.checkout(librarian, ayse.id, lent.copies[0].barcode);
    clock.advance(14 * DAY + 25 * DAY); // 25 days × 2.50 = 62.50 ≥ 50
    const { fine } = await circulation.returnCopy(librarian, lent.copies[0].barcode);

    await expectRefused(circulation.reserve(ayse, [wanted.id]), 'fines_over_limit');
    await desk.payFine(librarian, fine!.id);
    await expectRefused(desk.payFine(librarian, fine!.id), 'fine_not_unpaid');
    expect((await circulation.reserve(ayse, [wanted.id]))[0].status).toBe('READY');
  });

  it('blocked members cannot reserve', async () => {
    const ayse = await newMember();
    const book = await createBook(db);
    await db.prisma.profile.update({ where: { id: ayse.id }, data: { status: 'BLOCKED', blockedReason: 'Damaged books' } });
    await expectRefused(circulation.reserve(ayse, [book.id]), 'member_blocked');
  });
});

describe('desk lookup and reports', () => {
  it('finds members by card number or pickup code', async () => {
    const ayse = await createMember(db, { name: 'Ayşe Kaya' });
    const book = await createBook(db);
    const [r] = await circulation.reserve(asUser(ayse), [book.id]);

    expect((await desk.lookup(ayse.cardNumber))[0].id).toBe(ayse.id);
    expect((await desk.lookup(r.code.toLowerCase()))[0].id).toBe(ayse.id);
    const overview = await desk.member(ayse.id);
    expect(overview.readyReservations.map((x) => x.code)).toEqual([r.code]);
  });

  it('reports overdue loans with the fine they have run up', async () => {
    const ayse = await newMember();
    const book = await createBook(db, 'Fatih-Harbiye', 1);
    await circulation.checkout(librarian, ayse.id, book.copies[0].barcode);
    clock.advance(16 * DAY);

    const [row] = await reports.overdue();
    expect(row).toMatchObject({ bookTitle: 'Fatih-Harbiye', daysOverdue: 2, accruedFine: 5 });

    const csv = await reports.overdueCsv();
    expect(csv.startsWith('﻿member,email,card,book')).toBe(true);
    expect(csv).toContain('Fatih-Harbiye');

    const dashboard = await reports.dashboard();
    expect(dashboard).toMatchObject({ activeLoans: 1, overdueLoans: 1 });
    expect(dashboard.loansPerWeek).toHaveLength(8);
    expect(dashboard.loansPerWeek.reduce((s, w) => s + w.count, 0)).toBe(1);

    const [popular] = await reports.popular();
    expect(popular).toMatchObject({ loans: 1, book: { title: 'Fatih-Harbiye' } });
  });
});
