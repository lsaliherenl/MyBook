/** The collections page against PGlite with every migration applied. */
import { createBook, createTestDb, type TestDb } from '../../test/support/test-db.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { CatalogService } from './catalog.service.js';

const supabase = { publicUrl: (_bucket: string, path: string) => `https://storage.test/${path}` } as unknown as SupabaseService;

let db: TestDb;
let catalog: CatalogService;

beforeEach(async () => {
  db = await createTestDb();
  catalog = new CatalogService(db.prisma as unknown as PrismaService, supabase);
});

afterEach(() => db.close());

async function createCollection(slug: string, position: number, books: { id: string }[], extra: { isPublished?: boolean; isFeatured?: boolean } = {}) {
  return db.prisma.collection.create({
    data: {
      slug,
      position,
      kind: 'SCIENCE',
      titleTr: `TR ${slug}`,
      titleEn: `EN ${slug}`,
      curatorTr: 'Fen Fakültesi',
      curatorEn: 'Faculty of Science',
      isPublished: extra.isPublished ?? true,
      isFeatured: extra.isFeatured ?? false,
      items: { create: books.map((b, i) => ({ bookId: b.id, position: i })) },
    },
  });
}

describe('collections', () => {
  it('lists published collections in page order with their size and first three covers', async () => {
    const books = [];
    for (const title of ['Bir', 'İki', 'Üç', 'Dört']) books.push(await createBook(db, title));
    await createCollection('second', 2, books.slice(0, 1));
    await createCollection('first', 1, books, { isFeatured: true });
    await createCollection('draft', 0, books, { isPublished: false });

    const list = await catalog.collections();

    expect(list.map((c) => c.slug)).toEqual(['first', 'second']);
    expect(list[0]).toMatchObject({ kind: 'SCIENCE', featured: true, bookCount: 4, curatorEn: 'Faculty of Science' });
    expect(list[0].covers.map((b) => b.title)).toEqual(['Bir', 'İki', 'Üç']);
  });

  it('opens one collection with all its books, and hides drafts', async () => {
    const books = [await createBook(db, 'Bir'), await createBook(db, 'İki')];
    await createCollection('shelf', 0, books);
    await createCollection('draft', 1, books, { isPublished: false });

    expect(await catalog.collection('shelf')).toMatchObject({ slug: 'shelf', bookCount: 2, books: [{ title: 'Bir' }, { title: 'İki' }] });
    await expect(catalog.collection('draft')).rejects.toThrow('Collection not found');
  });
});
