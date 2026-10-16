import type { AvailabilityDto, BookDetailDto, BookSummaryDto } from '@mybook/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { COVERS_BUCKET, type SupabaseService } from '../supabase/supabase.service.js';

export const bookInclude = {
  authors: { include: { author: true }, orderBy: { position: 'asc' } },
  categories: { include: { category: true } },
  copies: { select: { status: true, shelfLocation: true } },
  publisher: true,
} satisfies Prisma.BookInclude;

export type BookWithRelations = Prisma.BookGetPayload<{ include: typeof bookInclude }>;

function availability(copies: BookWithRelations['copies']): AvailabilityDto {
  const count = (status: string) => copies.filter((c) => c.status === status).length;
  // Lost and withdrawn copies are no longer part of the collection.
  const inCollection = copies.filter((c) => c.status !== 'LOST' && c.status !== 'WITHDRAWN');
  return { total: inCollection.length, available: count('AVAILABLE'), onLoan: count('ON_LOAN'), onHold: count('ON_HOLD') };
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
    availability: availability(book.copies),
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
  };
}
