import { foldForSearch, type CollectionKind } from '@mybook/shared';
import type { PrismaService } from '../prisma/prisma.service.js';
import { STAFF_PICKS } from './books.js';
import type { SeedCategorySlug } from './categories.js';

/** Which books go on the shelf: named titles first, then books from categories, or the newest arrivals. */
interface Shelf {
  titles?: readonly string[];
  categories?: SeedCategorySlug[];
  newest?: boolean;
  limit?: number;
}

interface SeedCollection {
  slug: string;
  kind: CollectionKind;
  titleTr: string;
  titleEn: string;
  descriptionTr: string;
  descriptionEn: string;
  curatorTr: string;
  curatorEn: string;
  featured?: boolean;
  shelf: Shelf;
}

/** The collections page from the design, filled from the demo catalog. Order here is page order. */
export const SEED_COLLECTIONS: SeedCollection[] = [
  {
    slug: 'turkish-modern-classics',
    kind: 'LITERATURE',
    featured: true,
    titleTr: 'Modern Türk klasikleri',
    titleEn: 'Turkish modern classics',
    descriptionTr:
      'Tanpınar, Atay, Sabahattin Ali ve Cumhuriyet dönemini biçimlendiren romanlar — Türk Edebiyatı Okuma Grubu’nun seçimi; bu dönemin okuma halkası kitapları en üstte.',
    descriptionEn:
      'Tanpınar, Atay, Sabahattin Ali and the novels that shaped the Republic era — chosen by the Turkish Literature Reading Group, with this term’s reading circle books on top.',
    curatorTr: 'Türk Edebiyatı Okuma Grubu',
    curatorEn: 'Turkish Literature Reading Group',
    shelf: { titles: ['Tutunamayanlar', 'Kürk Mantolu Madonna', 'Saatleri Ayarlama Enstitüsü'], categories: ['turkish-literature'], limit: 64 },
  },
  {
    slug: 'fall-2026-course-reserves',
    kind: 'COURSE',
    titleTr: '2026 güz ders rezervleri',
    titleEn: 'Fall 2026 course reserves',
    descriptionTr: 'Bu dönemin zorunlu okumaları. Herkes sırayla okuyabilsin diye masada tutulur.',
    descriptionEn: 'Required readings for this term, kept at the desk so everyone gets a turn.',
    curatorTr: 'Öğretim üyelerince güncellenir',
    curatorEn: 'Updated by faculty',
    shelf: { categories: ['computer-science', 'mathematics', 'economics-business'], limit: 40 },
  },
  {
    slug: 'staff-picks',
    kind: 'LITERATURE',
    titleTr: 'Meraklı okurlar için',
    titleEn: 'Curated for curious readers',
    descriptionTr: 'Kütüphanecilerimizin bu ay elinden bırakamadıkları.',
    descriptionEn: 'What our librarians could not put down this month.',
    curatorTr: 'Kütüphanecilerimizin seçimi',
    curatorEn: 'Picked by our librarians',
    shelf: { titles: STAFF_PICKS },
  },
  {
    slug: 'science-and-nature',
    kind: 'SCIENCE',
    titleTr: 'Bilim ve doğa rafı',
    titleEn: 'Science & nature shelf',
    descriptionTr: 'Genler, yıldızlar, beyin ve onları okuyan insanlar — meraklı okur için anlaşılır bilim.',
    descriptionEn: 'Genes, stars, brains and the people who read them — science written for the curious reader.',
    curatorTr: 'Fen Fakültesi ile birlikte',
    curatorEn: 'With the Faculty of Science',
    shelf: { categories: ['science-nature', 'psychology'], limit: 40 },
  },
  {
    slug: 'world-literature',
    kind: 'LITERATURE',
    titleTr: 'Dünya edebiyatından',
    titleEn: 'From world literature',
    descriptionTr: 'Ödüllü romanlar, çeviri klasikler ve şiir — dünyanın dört bir yanından.',
    descriptionEn: 'Prize-winning novels, classics in translation and poetry from around the world.',
    curatorTr: 'Edebiyat katı kütüphanecileri',
    curatorEn: 'Literature floor librarians',
    shelf: { categories: ['world-literature', 'poetry'], limit: 48 },
  },
  {
    slug: 'new-this-month',
    kind: 'NEW',
    titleTr: 'Bu ay gelenler',
    titleEn: 'New this month',
    descriptionTr: 'Kataloğa en son eklenen kitaplar — yeni gelenler rafı zemin katta, masanın yanında.',
    descriptionEn: 'The latest additions to the catalog — the new arrivals shelf is on the ground floor, next to the desk.',
    curatorTr: 'Ödünç masası',
    curatorEn: 'Circulation desk',
    shelf: { newest: true, limit: 24 },
  },
  {
    slug: 'history-and-ideas',
    kind: 'SPECIAL',
    titleTr: 'Tarih ve düşünce',
    titleEn: 'History & ideas',
    descriptionTr: 'Felsefe, tarih ve anılar: sessiz katta uzun okumalar için.',
    descriptionEn: 'Philosophy, history and memoir: long reads for the quiet floor.',
    curatorTr: 'Arşiv ekibi · 3. kat',
    curatorEn: 'Archive team · 3rd floor',
    shelf: { categories: ['philosophy', 'history', 'biography-memoir'], limit: 48 },
  },
];

async function shelfBooks(prisma: PrismaService, shelf: Shelf): Promise<string[]> {
  const ids: string[] = [];
  for (const title of shelf.titles ?? []) {
    const book = await prisma.book.findFirst({ where: { searchText: { startsWith: foldForSearch(title) } }, select: { id: true } });
    if (book && !ids.includes(book.id)) ids.push(book.id);
  }
  const limit = shelf.limit ?? ids.length;
  if (shelf.categories && ids.length < limit) {
    const books = await prisma.book.findMany({
      where: { id: { notIn: ids }, categories: { some: { category: { slug: { in: shelf.categories } } } } },
      orderBy: [{ publishedYear: 'asc' }, { title: 'asc' }],
      take: limit - ids.length,
      select: { id: true },
    });
    ids.push(...books.map((b) => b.id));
  }
  if (shelf.newest && ids.length < limit) {
    const books = await prisma.book.findMany({ where: { id: { notIn: ids } }, orderBy: { createdAt: 'desc' }, take: limit - ids.length, select: { id: true } });
    ids.push(...books.map((b) => b.id));
  }
  return ids;
}

/** Creates or refreshes every demo collection and its books. Safe to run again. */
export async function seedCollections(prisma: PrismaService) {
  for (const [position, { shelf, featured = false, ...fields }] of SEED_COLLECTIONS.entries()) {
    const data = { ...fields, isFeatured: featured, isPublished: true, position };
    const collection = await prisma.collection.upsert({ where: { slug: fields.slug }, create: data, update: data });
    const bookIds = await shelfBooks(prisma, shelf);
    await prisma.collectionItem.deleteMany({ where: { collectionId: collection.id } });
    await prisma.collectionItem.createMany({ data: bookIds.map((bookId, i) => ({ collectionId: collection.id, bookId, position: i })) });
    console.log(`✓ collection ${fields.slug}: ${bookIds.length} books`);
  }
}
