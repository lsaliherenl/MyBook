import type { AvailabilityDto, BookDetailDto, BookSummaryDto } from '@mybook/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { COVERS_BUCKET, type SupabaseService } from '../supabase/supabase.service.js';

export const bookInclude = {
  authors: { include: { author: true }, orderBy: { position: 'asc' } },
  categories: { include: { category: true } },
  copies: {
    select: { status: true, shelfLocation: true, loans: { where: { status: 'ACTIVE' }, select: { dueAt: true } } },
    orderBy: { barcode: 'asc' },
  },
  publisher: true,
  _count: { select: { reservations: { where: { status: 'PENDING' } } } },
} satisfies Prisma.BookInclude;

const VISIBLE_COPY_STATUSES = new Set<string>(['AVAILABLE', 'ON_HOLD', 'ON_LOAN', 'IN_REPAIR']);

export type BookWithRelations = Prisma.BookGetPayload<{ include: typeof bookInclude }>;

function availability({ copies, _count }: BookWithRelations): AvailabilityDto {
  const count = (status: string) => copies.filter((c) => c.status === status).length;
  // Lost and withdrawn copies are no longer part of the collection.
  const inCollection = copies.filter((c) => c.status !== 'LOST' && c.status !== 'WITHDRAWN');
  return {
    total: inCollection.length,
    available: count('AVAILABLE'),
    onLoan: count('ON_LOAN'),
    onHold: count('ON_HOLD'),
    waiting: _count.reservations,
    nextDueAt: count('AVAILABLE') ? null : nextDue(copies),
  };
}

function nextDue(copies: BookWithRelations['copies']): string | null {
  const due = copies.flatMap((c) => c.loans.map((l) => l.dueAt.getTime()));
  return due.length ? new Date(Math.min(...due)).toISOString() : null;
}

export function toBookSummary(book: BookWithRelations, supabase: SupabaseService): BookSummaryDto {
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    subtitle: book.subtitle,
    authors: book.authors.map(({ author }) => ({ name: author.name, slug: author.slug })),
    coverUrl: book.coverPath ? supabase.publicUrl(COVERS_BUCKET, book.coverPath) : null,
    coverWidth: book.coverWidth,
    coverHeight: book.coverHeight,
    language: book.language,
    publishedYear: book.publishedYear,
    categories: book.categories.map(({ category: c }) => ({ slug: c.slug, nameTr: c.nameTr, nameEn: c.nameEn })),
    availability: availability(book),
  };
}

export function toBookDetail(book: BookWithRelations, supabase: SupabaseService): BookDetailDto {
  const shelves = book.copies.map((c) => c.shelfLocation).filter((s): s is string => Boolean(s));
  return {
    ...toBookSummary(book, supabase),
    description: book.description,
    isbn13: book.isbn13,
    isbn10: book.isbn10,
    publisher: book.publisher?.name ?? null,
    pageCount: book.pageCount,
    shelfLocations: [...new Set(shelves)].sort(),
    copies: book.copies
      .filter((c): c is typeof c & { status: BookDetailDto['copies'][number]['status'] } => VISIBLE_COPY_STATUSES.has(c.status))
      .map((c) => ({ status: c.status, shelfLocation: c.shelfLocation, dueAt: c.loans[0]?.dueAt.toISOString() ?? null })),
  };
}
