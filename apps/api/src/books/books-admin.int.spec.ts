/** Librarian book management against PGlite with every migration applied. */
import { createBook, createMember, createTestDb, type TestDb } from '../../test/support/test-db.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CirculationService } from '../circulation/circulation.service.js';
import { Clock } from '../circulation/clock.js';
import type { CoverService } from '../import/cover.service.js';
import type { ImportService } from '../import/import.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { BooksAdminService } from './books-admin.service.js';

class FakeClock extends Clock {
  current = new Date('2026-10-01T09:00:00Z');
  override now() {
    return new Date(this.current);
  }
}

const supabase = { publicUrl: (_bucket: string, path: string) => `https://storage.test/${path}` } as unknown as SupabaseService;
// ISBN lookups go to external providers; these tests only take the paths that never reach them.
const imports = { search: () => Promise.reject(new Error('no network in tests')) } as unknown as ImportService;

let db: TestDb;
let clock: FakeClock;
let books: BooksAdminService;
let circulation: CirculationService;
let librarian: AuthUser;

const asUser = (p: { id: string; email: string; role: AuthUser['role']; status: AuthUser['status'] }): AuthUser => ({ id: p.id, email: p.email, role: p.role, status: p.status });

beforeEach(async () => {
  db = await createTestDb();
  clock = new FakeClock();
  const prisma = db.prisma as unknown as PrismaService;
  books = new BooksAdminService(prisma, supabase, imports, {} as CoverService, clock);
  circulation = new CirculationService(prisma, supabase, clock);
  librarian = asUser(await createMember(db, { role: 'LIBRARIAN', name: 'Mehmet Demir' }));
});

afterEach(() => db.close());

describe('book list', () => {
  it('counts copies per title and filters by availability, search and shelf', async () => {
    const member = asUser(await createMember(db));
    const out = await createBook(db, 'Kürk Mantolu Madonna', 1);
    const shelf = await createBook(db, 'Huzur', 2);
    const repair = await createBook(db, 'Yaban', 1);
    await circulation.checkout(librarian, member.id, out.copies[0].barcode);
    await circulation.reserve(asUser(await createMember(db)), [out.id]);
    await db.prisma.bookCopy.update({ where: { id: repair.copies[0].id }, data: { status: 'IN_REPAIR', shelfLocation: 'XR-9' } });
    await db.prisma.book.update({ where: { id: out.id }, data: { searchText: 'kurk mantolu madonna sabahattin ali' } });

    const all = await books.list({ filter: 'all', page: 1, pageSize: 25 });
    expect(all.counts).toEqual({ all: 3, available: 1, out: 2, holds: 1, repair: 1 });
    expect(all.catalog).toEqual({ titles: 3, copies: 4 });
    expect(all.items.find((b) => b.title === 'Kürk Mantolu Madonna')).toMatchObject({ total: 1, available: 0, onLoan: 1, reserved: 1 });

    expect((await books.list({ filter: 'holds', page: 1, pageSize: 25 })).items.map((b) => b.title)).toEqual(['Kürk Mantolu Madonna']);
    expect((await books.list({ q: 'KURK mantolu', filter: 'all', page: 1, pageSize: 25 })).total).toBe(1);
    expect((await books.list({ q: 'xr', filter: 'all', page: 1, pageSize: 25 })).items.map((b) => b.title)).toEqual(['Yaban']);
    expect((await books.list({ q: shelf.copies[1].barcode, filter: 'all', page: 1, pageSize: 25 })).items.map((b) => b.title)).toEqual(['Huzur']);

    const csv = await books.listCsv({ filter: 'all', page: 1, pageSize: 25 });
    expect(csv.split('\r\n')[0]).toBe('﻿title,authors,year,isbn13,categories,shelves,total,available,on_loan,in_repair,reserved');
  });

  it('moves shelves and withdraws in bulk, leaving copies on loan alone', async () => {
    const member = asUser(await createMember(db));
    const a = await createBook(db, 'Bir', 2);
    const b = await createBook(db, 'İki', 1);
    await circulation.checkout(librarian, member.id, a.copies[0].barcode);

    expect(await books.bulk(librarian, { bookIds: [a.id, b.id], shelfLocation: 'NEW-1' })).toEqual({ changed: 3 });
    expect(await books.bulk(librarian, { bookIds: [a.id, b.id], withdraw: true })).toEqual({ changed: 2 });
    const statuses = await db.prisma.bookCopy.findMany({ orderBy: { barcode: 'asc' }, select: { status: true, shelfLocation: true } });
    expect(statuses).toEqual([
      { status: 'ON_LOAN', shelfLocation: 'NEW-1' },
      { status: 'WITHDRAWN', shelfLocation: 'NEW-1' },
      { status: 'WITHDRAWN', shelfLocation: 'NEW-1' },
    ]);
  });
});

describe('editing a book', () => {
  it('updates details, authors and categories, and refuses an ISBN another book has', async () => {
    const book = await createBook(db, 'Kurk Mantolu', 1);
    const other = await createBook(db, 'Başka', 1);
    await db.prisma.book.update({ where: { id: other.id }, data: { isbn13: '9789750806978' } });
    const category = await db.prisma.category.create({ data: { slug: 'novel', nameTr: 'Roman', nameEn: 'Novel' } });

    const saved = await books.update(librarian, book.id, {
      title: 'Kürk Mantolu Madonna',
      authors: ['Sabahattin Ali'],
      publisher: 'Yapı Kredi Yayınları',
      language: 'tr',
      publishedYear: 1943,
      categoryIds: [category.id],
    });
    expect(saved).toMatchObject({ title: 'Kürk Mantolu Madonna', authors: ['Sabahattin Ali'], publisher: 'Yapı Kredi Yayınları', categoryIds: [category.id] });
    expect((await books.list({ q: 'sabahattin', filter: 'all', page: 1, pageSize: 25 })).total).toBe(1);

    await expect(books.update(librarian, book.id, { title: 'X', authors: ['Y'], language: 'tr', categoryIds: [], isbn13: '9789750806978' })).rejects.toMatchObject({
      code: 'isbn_taken',
    });
  });

  it('new copies go straight to the next reader in line', async () => {
    const [a, b] = [asUser(await createMember(db)), asUser(await createMember(db, { name: 'Can Öztürk' }))];
    const book = await createBook(db, 'Dune', 1);
    await circulation.checkout(librarian, a.id, book.copies[0].barcode);
    await circulation.reserve(b, [book.id]);

    const { barcodes } = await books.addCopies(librarian, book.id, { count: 2, shelfLocation: 'BF-101' });

    expect(barcodes).toHaveLength(2);
    expect((await circulation.reservationsOf(b.id))[0]).toMatchObject({ status: 'READY', copyBarcode: barcodes[0] });
    const detail = await books.get(book.id);
    expect(detail.copies.map((c) => c.status)).toEqual(['ON_LOAN', 'ON_HOLD', 'AVAILABLE']);
    expect(detail.copies[1].holder).toMatchObject({ memberName: 'Can Öztürk' });
  });

  it('sends a copy to repair and back; a repaired copy serves the waitlist; loaned copies are left to the desk', async () => {
    const [a, b] = [asUser(await createMember(db)), asUser(await createMember(db))];
    const book = await createBook(db, 'Simyacı', 2);
    await circulation.checkout(librarian, a.id, book.copies[0].barcode);

    await books.updateCopy(librarian, book.copies[1].id, { status: 'IN_REPAIR', condition: 'POOR' });
    await circulation.reserve(b, [book.id]); // nothing on the shelf: b waits
    expect((await circulation.reservationsOf(b.id))[0].status).toBe('PENDING');

    const detail = await books.updateCopy(librarian, book.copies[1].id, { status: 'AVAILABLE', condition: 'GOOD' });
    expect(detail.copies[1]).toMatchObject({ status: 'ON_HOLD', condition: 'GOOD' });
    expect((await circulation.reservationsOf(b.id))[0].status).toBe('READY');

    await expect(books.updateCopy(librarian, book.copies[0].id, { status: 'LOST' })).rejects.toMatchObject({ code: 'copy_in_circulation' });
  });

  it('keeps a copy history and a timeline of the title', async () => {
    const member = asUser(await createMember(db, { name: 'Elif Şahin' }));
    const book = await createBook(db, 'Huzur', 1);
    await circulation.checkout(librarian, member.id, book.copies[0].barcode);
    clock.current = new Date(clock.current.getTime() + 16 * 86_400_000);
    await circulation.returnCopy(librarian, book.copies[0].barcode);
    await books.addCopies(librarian, book.id, { count: 1 });

    const [loan] = await books.copyHistory(book.copies[0].id);
    expect(loan).toMatchObject({ memberName: 'Elif Şahin', daysOverdue: 2, fine: 5 });

    const activity = await books.activity(book.id);
    expect(activity.map((a) => a.kind)).toEqual(['copies', 'return', 'checkout']);
    expect(activity[2]).toMatchObject({ actor: 'Mehmet Demir', data: { member: 'Elif Şahin' } });
  });
});

describe('bulk import rows', () => {
  it('rejects malformed ISBNs and adds copies to titles already in the catalog', async () => {
    const book = await createBook(db, 'Kürk Mantolu Madonna', 1);
    await db.prisma.book.update({ where: { id: book.id }, data: { isbn13: '9789750806978' } });

    expect(await books.importIsbn(librarian, { isbn: '978-605-332-01' })).toMatchObject({ status: 'invalid' });
    expect(await books.importIsbn(librarian, { isbn: '978-975-08-0697-8', copies: 2, shelfLocation: 'TE-1' })).toMatchObject({
      status: 'copies_added',
      bookId: book.id,
    });
    expect(await db.prisma.bookCopy.count({ where: { bookId: book.id } })).toBe(3);
  });
});
