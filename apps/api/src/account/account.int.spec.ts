/** Reading lists, the reading-year summary and account closure against PGlite with every migration applied. */
import { createBook, createMember, createTestDb, type TestDb } from '../../test/support/test-db.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CirculationService } from '../circulation/circulation.service.js';
import { Clock } from '../circulation/clock.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { AccountService } from './account.service.js';
import { ListsService } from './lists.service.js';

const DAY = 24 * 60 * 60 * 1000;

class FakeClock extends Clock {
  current = new Date('2026-03-02T09:00:00Z');
  override now() {
    return new Date(this.current);
  }
}

const adminCalls: unknown[] = [];
const supabase = {
  publicUrl: (_bucket: string, path: string) => `https://storage.test/${path}`,
  client: { auth: { admin: { updateUserById: async (...args: unknown[]) => (adminCalls.push(args), { error: null }) } } },
} as unknown as SupabaseService;

let db: TestDb;
let clock: FakeClock;
let circulation: CirculationService;
let lists: ListsService;
let account: AccountService;
let librarian: AuthUser;

const asUser = (p: { id: string; email: string; role: AuthUser['role']; status: AuthUser['status'] }): AuthUser => ({ ...p });

beforeEach(async () => {
  db = await createTestDb();
  clock = new FakeClock();
  const prisma = db.prisma as unknown as PrismaService;
  circulation = new CirculationService(prisma, supabase, clock);
  lists = new ListsService(prisma, supabase);
  account = new AccountService(prisma, supabase, circulation, lists, clock);
  librarian = asUser(await createMember(db, { role: 'LIBRARIAN', name: 'Mehmet Demir' }));
});

afterEach(() => db.close());

/** Reserves, checks out and returns a book `days` after now. */
async function borrowAndReturn(member: AuthUser, title: string, days: number) {
  const book = await createBook(db, title, 1);
  await circulation.reserve(member, [book.id]);
  await circulation.checkout(librarian, member.id, book.copies[0].barcode);
  clock.current = new Date(clock.current.getTime() + days * DAY);
  await circulation.returnCopy(librarian, book.copies[0].barcode);
  return book;
}

describe('reading lists', () => {
  it('keeps favorites and named lists apart, and only for their owner', async () => {
    const ayse = asUser(await createMember(db));
    const burak = asUser(await createMember(db, { name: 'Burak Yıldız' }));
    const [huzur, aylak] = [await createBook(db, 'Huzur'), await createBook(db, 'Aylak Adam')];

    await lists.addBook(ayse.id, 'favorites', huzur.id);
    const { id } = await lists.create(ayse.id, 'Turkish modern classics');
    await lists.addBook(ayse.id, id, huzur.id);
    await lists.addBook(ayse.id, id, aylak.id);
    await lists.addBook(ayse.id, id, aylak.id); // adding twice is harmless

    const all = await lists.all(ayse.id);
    expect(all.map((l) => [l.id, l.bookCount])).toEqual([
      ['favorites', 1],
      [id, 2],
    ]);
    expect(await lists.containing(ayse.id, huzur.id)).toEqual(['favorites', id]);
    await expect(lists.addBook(burak.id, id, huzur.id)).rejects.toThrow('List not found');
    await expect(lists.detail(burak.id, id)).rejects.toThrow('List not found');

    await lists.removeBook(ayse.id, id, huzur.id);
    expect((await lists.detail(ayse.id, id)).books.map((b) => b.title)).toEqual(['Aylak Adam']);
  });
});

describe('reading year', () => {
  it('counts returned books per month with pages, top subject and author', async () => {
    const ayse = asUser(await createMember(db));
    const category = await db.prisma.category.create({ data: { slug: 'turkish-literature', nameTr: 'Türk Edebiyatı', nameEn: 'Turkish Literature' } });
    const author = await db.prisma.author.create({ data: { name: 'Oğuz Atay', slug: 'oguz-atay' } });
    const first = await borrowAndReturn(ayse, 'Tutunamayanlar', 10);
    const second = await borrowAndReturn(ayse, 'Tehlikeli Oyunlar', 40);
    for (const [book, pages] of [[first, 724], [second, 480]] as const) {
      await db.prisma.book.update({
        where: { id: book.id },
        data: { pageCount: pages, categories: { create: { categoryId: category.id } }, authors: { create: { authorId: author.id } } },
      });
    }

    const year = await account.readingYear(ayse.id, 2026);

    expect(year.books).toBe(2);
    expect(year.pages).toBe(1204);
    expect(year.perMonth.slice(0, 5)).toEqual([0, 0, 1, 1, 0]); // returned Mar 12 and Apr 21
    expect(year.topCategory).toMatchObject({ slug: 'turkish-literature', count: 2 });
    expect(year.topAuthor).toEqual({ name: 'Oğuz Atay', count: 2 });
    expect(year.loans.map((l) => l.book.title)).toEqual(['Tehlikeli Oyunlar', 'Tutunamayanlar']);
    expect(year.years).toEqual([2026]);
  });
});

describe('closing an account', () => {
  it('refuses while a book is out, then anonymises the profile', async () => {
    const ayse = asUser(await createMember(db));
    const book = await createBook(db, 'Huzur');
    await circulation.reserve(ayse, [book.id]);
    await circulation.checkout(librarian, ayse.id, book.copies[0].barcode);

    await expect(account.close(ayse)).rejects.toMatchObject({ response: { code: 'account_has_open_items', loans: 1 } });

    await circulation.returnCopy(librarian, book.copies[0].barcode);
    await account.close(ayse);

    const profile = await db.prisma.profile.findUniqueOrThrow({ where: { id: ayse.id } });
    expect(profile).toMatchObject({ fullName: 'Closed account', status: 'BLOCKED', studentNumber: null });
    expect(profile.email).toBe(`closed-${ayse.id}@mybook.invalid`);
    expect(await db.prisma.loan.count({ where: { memberId: ayse.id } })).toBe(1); // history stays for the library
    expect(adminCalls).toHaveLength(1);
  });
});
