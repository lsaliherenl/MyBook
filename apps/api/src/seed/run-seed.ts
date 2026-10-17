/**
 * Fills the catalog with demo data: categories, library events, ~150 books found through the book providers
 * (Google Books for metadata, Apple Books for covers), demo copies and a staff-picks collection.
 * Safe to run again: existing categories and books are kept; books without a cover get another try.
 *
 *   pnpm --filter @mybook/api db:seed
 *   pnpm --filter @mybook/api db:seed --refresh-covers   (pick every cover again)
 *   pnpm --filter @mybook/api db:seed --refresh-small-covers
 */
import '../network.js';
import { NestFactory } from '@nestjs/core';
import { foldForSearch, slugify, type ExternalBookCandidate, type ImportBookInput } from '@mybook/shared';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { COVERS_BUCKET, SupabaseService } from '../supabase/supabase.service.js';
import { BookSourceService } from '../import/book-source.service.js';
import { CoverService } from '../import/cover.service.js';
import { ImportService } from '../import/import.service.js';
import { authorsOverlap, titlesMatch } from '../import/matching.js';
import { SEED_BOOKS, STAFF_PICKS, type SeedBook } from './books.js';
import { SEED_CATEGORIES } from './categories.js';
import { seedEvents } from './events.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const REFRESH_COVERS = process.argv.includes('--refresh-covers');
/** Covers narrower than this look soft on high-density screens; a sharper alternative is tried. */
const GOOD_COVER_WIDTH = 600;
const REFRESH_SMALL = process.argv.includes('--refresh-small-covers');

function matches(seed: SeedBook, c: ExternalBookCandidate): boolean {
  return titlesMatch(c.title, seed.title) && authorsOverlap(c.authors, seed.authors);
}

/** Prefers the edition in the wanted language with the most complete record. */
function pickGoogle(seed: SeedBook, candidates: ExternalBookCandidate[]): ExternalBookCandidate | null {
  const score = (c: ExternalBookCandidate) =>
    (c.isbn13 ? 3 : 0) + (c.covers.length ? 2 : 0) + ((c.description?.length ?? 0) > 100 ? 2 : 0) + (c.pageCount ? 1 : 0) + (c.publisher ? 1 : 0);
  return (
    candidates
      .filter((c) => matches(seed, c) && (!c.language || c.language === seed.lang))
      .sort((a, b) => score(b) - score(a))[0] ?? null
  );
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const sources = app.get(BookSourceService);
  const imports = app.get(ImportService);
  const covers = app.get(CoverService);
  const supabase = app.get(SupabaseService);

  // Categories
  const categoryIds = new Map<string, string>();
  for (const [position, c] of SEED_CATEGORIES.entries()) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, nameTr: c.nameTr, nameEn: c.nameEn, position },
      update: { nameTr: c.nameTr, nameEn: c.nameEn, position },
    });
    categoryIds.set(c.slug, row.id);
  }
  console.log(`✓ ${SEED_CATEGORIES.length} categories`);

  const report = { imported: 0, existing: 0, notFound: [] as string[], noCover: [] as string[], failed: [] as string[] };

  for (const [i, seed] of SEED_BOOKS.entries()) {
    const label = `${seed.title} — ${seed.authors[0]}`;
    const exists = await prisma.book.findFirst({
      where: {
        searchText: { startsWith: foldForSearch(seed.title) },
        authors: { some: { author: { slug: { in: seed.authors.map(slugify) } } } },
      },
      select: { id: true, coverPath: true, coverWidth: true },
    });
    const refresh = REFRESH_COVERS || (REFRESH_SMALL && (exists?.coverWidth ?? 0) < GOOD_COVER_WIDTH);
    if (exists?.coverPath && !refresh) {
      report.existing++;
      continue;
    }

    const query = `${seed.title} ${seed.authors[0]}`;
    const [google, apple] = await Promise.all([
      sources.search(query, 10, ['GOOGLE_BOOKS']),
      sources.search(query, 8, ['APPLE_BOOKS']),
    ]);
    const g = google[0]?.ok ? pickGoogle(seed, google[0].candidates) : null;
    const a = apple[0]?.ok ? (apple[0].candidates.find((c) => matches(seed, c) && c.covers.length) ?? null) : null;

    if (!g && !a) {
      report.notFound.push(label);
      console.log(`✗ ${label}: not found`);
      continue;
    }

    // Google's scan belongs to the same printed edition as the metadata; Apple's artwork is sharper
    // but often an unrelated ebook edition, so it is the fallback.
    const coverOptions = [...(g?.covers ?? []), ...(a?.covers ?? [])];

    /**
     * Stores the first cover that passes the checks; when it is small, the remaining candidates
     * are tried as well and the widest one is kept.
     */
    const storeFirstCover = async (bookId: string): Promise<boolean> => {
      let best: { path: string; width: number; height: number; provider: (typeof coverOptions)[number]['provider'] } | null = null;
      for (const option of coverOptions) {
        if (best && best.width >= GOOD_COVER_WIDTH) break;
        try {
          const cover = await covers.store(bookId, option.url, option.provider);
          if (best && cover.width <= best.width) {
            await supabase.remove(COVERS_BUCKET, cover.path);
            continue;
          }
          if (best) await supabase.remove(COVERS_BUCKET, best.path);
          best = { ...cover, provider: option.provider };
        } catch (error) {
          console.log(`  cover ${option.provider} failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      if (!best) return false;

      const previous = await prisma.book.findUnique({ where: { id: bookId }, select: { coverPath: true } });
      await prisma.book.update({
        where: { id: bookId },
        data: { coverPath: best.path, coverWidth: best.width, coverHeight: best.height, coverSource: best.provider },
      });
      if (previous?.coverPath) await supabase.remove(COVERS_BUCKET, previous.coverPath);
      return true;
    };

    // Already imported by an earlier run: only (re)try the cover.
    if (exists) {
      const ok = await storeFirstCover(exists.id);
      if (!ok) report.noCover.push(label);
      report.existing++;
      console.log(`↻ ${label}${ok ? ': cover stored' : ': no cover'}`);
      await sleep(1500);
      continue;
    }

    const shelf = SEED_CATEGORIES.find((c) => c.slug === seed.categories[0])!.shelf;
    const description = (g?.description?.length ?? 0) > 80 ? g!.description : (a?.description ?? g?.description ?? null);

    const input: ImportBookInput = {
      title: seed.title,
      subtitle: g && foldForSearch(g.title) === foldForSearch(seed.title) ? g.subtitle : null,
      authors: seed.authors,
      publisher: g?.publisher ?? null,
      publishedYear: g?.publishedYear ?? a?.publishedYear ?? null,
      pageCount: g?.pageCount ?? null,
      language: seed.lang,
      description: description?.slice(0, 10_000) ?? null,
      isbn13: g?.isbn13 ?? null,
      isbn10: g?.isbn10 ?? null,
      categoryIds: seed.categories.map((slug) => categoryIds.get(slug)!),
      cover: null, // stored below, trying every candidate in turn
      externalIds: { googleVolumeId: g?.externalId ?? null, appleTrackId: a?.externalId ?? null },
      copies: { count: 1 + (i % 4), shelfLocation: `${shelf}-${100 + i}` },
    };

    try {
      let result;
      try {
        result = await imports.importBook(input, null);
      } catch (error) {
        // Two editions sometimes share an ISBN in Google's data; keep the book without it.
        if (!(error instanceof Error && error.message.includes('ISBN'))) throw error;
        result = await imports.importBook({ ...input, isbn13: null, isbn10: null }, null);
      }

      const hasCover = await storeFirstCover(result.book.id);
      if (!hasCover) report.noCover.push(label);
      report.imported++;
      console.log(`✓ ${label}${hasCover ? '' : ' (no cover)'}`);
    } catch (error) {
      report.failed.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      console.log(`✗ ${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
    await sleep(1500); // Apple's search API allows roughly 20 requests a minute.
  }

  // Staff picks collection for the home page
  const picks = [];
  for (const title of STAFF_PICKS) {
    const book = await prisma.book.findFirst({ where: { searchText: { startsWith: foldForSearch(title) } }, select: { id: true } });
    if (book) picks.push(book.id);
  }
  const collection = await prisma.collection.upsert({
    where: { slug: 'staff-picks' },
    create: {
      slug: 'staff-picks',
      titleTr: 'Meraklı okurlar için',
      titleEn: 'Curated for curious readers',
      descriptionTr: 'Kütüphanecilerimizin bu ay elinden bırakamadıkları.',
      descriptionEn: 'What our librarians could not put down this month.',
      isPublished: true,
    },
    update: {},
  });
  await prisma.collectionItem.deleteMany({ where: { collectionId: collection.id } });
  await prisma.collectionItem.createMany({ data: picks.map((bookId, position) => ({ collectionId: collection.id, bookId, position })) });
  console.log(`✓ staff picks: ${picks.length} books`);

  // After the books, so events can point at the book to bring.
  await seedEvents(prisma);

  console.log(
    `\nImported ${report.imported}, already there ${report.existing}, not found ${report.notFound.length}, ` +
      `without cover ${report.noCover.length}, failed ${report.failed.length}`,
  );
  for (const line of [...report.notFound.map((l) => `not found: ${l}`), ...report.noCover.map((l) => `no cover: ${l}`), ...report.failed]) {
    console.log(`  - ${line}`);
  }
  await app.close();
}

await main();
