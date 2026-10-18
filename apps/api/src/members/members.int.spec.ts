/** Librarian member views against PGlite with every migration applied. */
import { createBook, createMember, createTestDb, type TestDb } from '../../test/support/test-db.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CirculationService } from '../circulation/circulation.service.js';
import { Clock } from '../circulation/clock.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { MembersService } from './members.service.js';

const DAY = 86_400_000;

class FakeClock extends Clock {
  current = new Date('2026-10-01T09:00:00Z');
  override now() {
    return new Date(this.current);
  }
}

const supabase = { publicUrl: (_bucket: string, path: string) => `https://storage.test/${path}` } as unknown as SupabaseService;

let db: TestDb;
let clock: FakeClock;
let members: MembersService;
let circulation: CirculationService;
let librarian: AuthUser;

const asUser = (p: { id: string; email: string; role: AuthUser['role']; status: AuthUser['status'] }): AuthUser => ({ id: p.id, email: p.email, role: p.role, status: p.status });

beforeEach(async () => {
  db = await createTestDb();
  clock = new FakeClock();
  const prisma = db.prisma as unknown as PrismaService;
  circulation = new CirculationService(prisma, supabase, clock);
  members = new MembersService(prisma, circulation, clock);
  librarian = asUser(await createMember(db, { role: 'LIBRARIAN', name: 'Mehmet Demir' }));
});

afterEach(() => db.close());

describe('member list', () => {
  it('counts loans, overdue loans and running fines, and filters by type and trouble', async () => {
    const ayse = asUser(await createMember(db, { name: 'Ayşe Yılmaz' }));
    const can = asUser(await createMember(db, { name: 'Can Öztürk' }));
    await db.prisma.profile.update({ where: { id: can.id }, data: { memberType: 'ACADEMIC', status: 'BLOCKED', blockedReason: 'Lost a book' } });
    const [a, b] = [await createBook(db, 'Bir', 1), await createBook(db, 'İki', 1)];
    await circulation.checkout(librarian, ayse.id, a.copies[0].barcode);
    await circulation.checkout(librarian, ayse.id, b.copies[0].barcode);
    clock.current = new Date(clock.current.getTime() + 16 * DAY); // both 2 days late

    const list = await members.list({ filter: 'all', page: 1, pageSize: 25 });
    expect(list.counts).toMatchObject({ all: 3, STUDENT: 2, ACADEMIC: 1, overdue: 1, blocked: 1 });
    expect(list.kpis).toMatchObject({ members: 3, borrowing: 1, blocked: 1, withOverdue: 1 });
    expect(list.items.find((m) => m.fullName === 'Ayşe Yılmaz')).toMatchObject({ activeLoans: 2, overdueLoans: 2, fines: 10 });

    expect((await members.list({ filter: 'blocked', page: 1, pageSize: 25 })).items.map((m) => m.fullName)).toEqual(['Can Öztürk']);
    expect((await members.list({ q: 'ayşe', filter: 'all', page: 1, pageSize: 25 })).total).toBe(1);
    const csv = await members.listCsv({ filter: 'overdue', page: 1, pageSize: 25 });
    expect(csv).toContain('Ayşe Yılmaz');
    expect(csv).not.toContain('Can Öztürk');
  });
});

describe('member record', () => {
  it('shows loans, reservations, fines, the year and a history', async () => {
    const ayse = asUser(await createMember(db, { name: 'Ayşe Yılmaz' }));
    const [read, wanted] = [await createBook(db, 'Huzur', 1), await createBook(db, 'Yaban', 1)];
    await circulation.checkout(librarian, ayse.id, read.copies[0].barcode);
    clock.current = new Date(clock.current.getTime() + 15 * DAY);
    await circulation.returnCopy(librarian, read.copies[0].barcode); // 1 day late, 2.50
    const [r] = await circulation.reserve(ayse, [wanted.id]);

    const record = await members.get(ayse.id);
    expect(record.reservations.map((x) => x.code)).toEqual([r.code]);
    expect(record.fines).toMatchObject([{ amount: 2.5, status: 'UNPAID' }]);
    expect(record.year).toEqual({ year: 2026, borrowed: 1, returnedOnTimePct: 0 });
    // Reservations are stamped by the database clock, not the fake one, so only the set is compared.
    expect(record.history.map((h) => h.kind).sort()).toEqual(['borrowed', 'reserved', 'returned']);
    expect(record.history.find((h) => h.kind === 'returned')).toMatchObject({ bookTitle: 'Huzur', daysLate: 1, fine: 2.5 });

    const notes = await members.addNote(librarian, ayse.id, 'Prefers pickup after 17:00.');
    expect(notes).toMatchObject([{ text: 'Prefers pickup after 17:00.', author: 'Mehmet Demir' }]);
  });

  it('lets a librarian renew on the member’s behalf, but not another member', async () => {
    const [ayse, can] = [asUser(await createMember(db)), asUser(await createMember(db))];
    const book = await createBook(db, 'Dune', 1);
    const { loan } = await circulation.checkout(librarian, ayse.id, book.copies[0].barcode);

    const renewed = await circulation.renew(librarian, loan.id);
    expect(renewed.renewCount).toBe(1);
    await expect(circulation.renew(can, loan.id)).rejects.toMatchObject({ code: 'loan_not_found' });
  });
});
