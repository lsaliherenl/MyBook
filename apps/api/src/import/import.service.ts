import { ConflictException, Injectable, Logger } from '@nestjs/common';
import {
  foldForSearch,
  slugify,
  type BookDetailDto,
  type CoverCandidate,
  type ExternalBookCandidate,
  type ImportBookInput,
  type ImportSearchInput,
  type ImportSearchResult,
} from '@mybook/shared';
import { randomBytes } from 'node:crypto';
import type { AuthUser } from '../auth/auth.types.js';
import { bookInclude, toBookDetail } from '../catalog/book.mapper.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { BookSourceService } from './book-source.service.js';
import { CoverService } from './cover.service.js';
import { authorsOverlap, isbn10To13, titlesMatch } from './matching.js';

export interface ImportBookResult {
  book: BookDetailDto;
  /** Set when the book was saved but its cover could not be stored. */
  coverError: string | null;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly sources: BookSourceService,
    private readonly covers: CoverService,
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  async search(input: ImportSearchInput): Promise<ImportSearchResult> {
    const results = input.isbn ? await this.sources.findByIsbn(input.isbn) : await this.sources.search(input.q!);
    const candidates = results.flatMap((r) => (r.ok ? r.candidates : []));
    const errors = results.flatMap((r) => (r.ok ? [] : [{ provider: r.provider, message: r.message }]));

    let extraCovers: CoverCandidate[] = [];
    let existingBookId: string | null = null;
    if (input.isbn) {
      const isbn13 = input.isbn.length === 10 ? isbn10To13(input.isbn) : input.isbn;
      existingBookId = (await this.prisma.book.findUnique({ where: { isbn13 }, select: { id: true } }))?.id ?? null;
      extraCovers = await this.findMatchingCovers(candidates);
    }
    return { candidates, extraCovers, errors, existingBookId };
  }

  /**
   * An ISBN lookup rarely hits Apple Books (it only knows ebook ISBNs), but Apple has the best covers.
   * Search it by title and author and keep only results that are clearly the same book.
   */
  private async findMatchingCovers(candidates: ExternalBookCandidate[]): Promise<CoverCandidate[]> {
    const reference = candidates.find((c) => c.authors.length > 0);
    if (!reference || candidates.some((c) => c.provider === 'APPLE_BOOKS' && c.covers.length)) return [];

    const [apple] = await this.sources.search(`${reference.title} ${reference.authors[0]}`, 5, ['APPLE_BOOKS']);
    if (!apple?.ok) return [];
    return apple.candidates
      .filter((c) => titlesMatch(c.title, reference.title) && authorsOverlap(c.authors, reference.authors))
      .flatMap((c) => c.covers);
  }

  async importBook(input: ImportBookInput, actor: AuthUser | null): Promise<ImportBookResult> {
    if (input.isbn13 && (await this.prisma.book.findUnique({ where: { isbn13: input.isbn13 }, select: { id: true } }))) {
      throw new ConflictException('A book with this ISBN is already in the catalog');
    }

    const authorIds: string[] = [];
    for (const name of input.authors) {
      const slug = slugify(name) || randomSuffix();
      const author = await this.prisma.author.upsert({ where: { slug }, create: { name, slug }, update: {} });
      if (!authorIds.includes(author.id)) authorIds.push(author.id);
    }
    const publisher = input.publisher
      ? await this.prisma.publisher.upsert({ where: { name: input.publisher }, create: { name: input.publisher }, update: {} })
      : null;

    const searchText = foldForSearch(
      [input.title, input.subtitle, ...input.authors, input.isbn13, input.isbn10].filter(Boolean).join(' '),
    );

    const book = await this.prisma.$transaction(async (tx) => {
      const created = await tx.book.create({
        data: {
          slug: await this.uniqueSlug(input.title, input.publishedYear ?? null),
          title: input.title,
          subtitle: input.subtitle ?? null,
          description: input.description ?? null,
          language: input.language,
          publishedYear: input.publishedYear ?? null,
          pageCount: input.pageCount ?? null,
          isbn13: input.isbn13 ?? null,
          isbn10: input.isbn10 ?? null,
          publisherId: publisher?.id ?? null,
          googleVolumeId: input.externalIds.googleVolumeId ?? null,
          openLibraryId: input.externalIds.openLibraryId ?? null,
          appleTrackId: input.externalIds.appleTrackId ?? null,
          importedById: actor?.id ?? null,
          searchText,
          authors: { create: authorIds.map((authorId, position) => ({ authorId, position })) },
          categories: { create: input.categoryIds.map((categoryId) => ({ categoryId })) },
          copies: { create: Array.from({ length: input.copies.count }, () => ({ shelfLocation: input.copies.shelfLocation ?? null })) },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor?.id ?? null,
          action: 'book.import',
          entityType: 'book',
          entityId: created.id,
          data: { title: input.title, isbn13: input.isbn13 ?? null, copies: input.copies.count },
        },
      });
      return created;
    });

    let coverError: string | null = null;
    if (input.cover) {
      try {
        const cover = await this.covers.store(book.id, input.cover.url, input.cover.provider);
        await this.prisma.book.update({
          where: { id: book.id },
          data: { coverPath: cover.path, coverWidth: cover.width, coverHeight: cover.height, coverSource: input.cover.provider },
        });
      } catch (error) {
        coverError = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Cover for book ${book.id} not stored: ${coverError}`);
      }
    }

    const saved = await this.prisma.book.findUniqueOrThrow({ where: { id: book.id }, include: bookInclude });
    return { book: toBookDetail(saved, this.supabase), coverError };
  }

  private async uniqueSlug(title: string, year: number | null): Promise<string> {
    const base = slugify(title) || 'book';
    for (const slug of [base, year ? `${base}-${year}` : null, `${base}-${randomSuffix()}`]) {
      if (slug && !(await this.prisma.book.findUnique({ where: { slug }, select: { id: true } }))) return slug;
    }
    return `${base}-${randomSuffix()}-${randomSuffix()}`;
  }
}

function randomSuffix(): string {
  return randomBytes(3).toString('hex');
}
