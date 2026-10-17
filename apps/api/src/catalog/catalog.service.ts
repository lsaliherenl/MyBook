import { Injectable, NotFoundException } from '@nestjs/common';
import {
  foldForSearch,
  type BookDetailDto,
  type BookSummaryDto,
  type CatalogFacetsDto,
  type CatalogQuery,
  type CategoryDto,
  type CollectionDto,
  type CollectionSummaryDto,
  type Paginated,
  type PopularBookDto,
  type PopularBooksQuery,
  type RelatedBooksDto,
} from '@mybook/shared';
import type { Collection, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { bookInclude, toBookDetail, toBookSummary } from './book.mapper.js';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  async list(query: CatalogQuery): Promise<Paginated<BookSummaryDto>> {
    const terms = searchTerms(query);
    const where = buildWhere(query);
    const orderBy: Prisma.BookOrderByWithRelationInput[] = {
      relevance: terms.length ? [{ title: 'asc' as const }] : [{ createdAt: 'desc' as const }],
      title: [{ title: 'asc' as const }],
      newest: [{ publishedYear: { sort: 'desc' as const, nulls: 'last' as const } }, { title: 'asc' as const }],
      popular: [{ reservations: { _count: 'desc' as const } }, { title: 'asc' as const }],
    }[query.sort];

    const [total, books] = await Promise.all([
      this.prisma.book.count({ where }),
      this.prisma.book.findMany({
        where,
        orderBy,
        include: bookInclude,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: books.map((b) => toBookSummary(b, this.supabase)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  /** Filter counts for the catalog sidebar, for the current search and the other filters. */
  async facets(query: CatalogQuery): Promise<CatalogFacetsDto> {
    const [categories, languages, authors, catalogTotal] = await Promise.all([
      this.prisma.bookCategory.groupBy({
        by: ['categoryId'],
        where: { book: buildWhere(query, 'category') },
        _count: { _all: true },
      }),
      this.prisma.book.groupBy({
        by: ['language'],
        where: buildWhere(query, 'language'),
        _count: { _all: true },
        orderBy: { _count: { language: 'desc' } },
      }),
      this.prisma.bookAuthor.groupBy({
        by: ['authorId'],
        where: { book: buildWhere(query, 'author') },
        _count: { _all: true },
        orderBy: { _count: { authorId: 'desc' } },
        take: 8,
      }),
      this.prisma.book.count(),
    ]);
    const [categoryRows, authorRows] = await Promise.all([
      this.prisma.category.findMany({ where: { id: { in: categories.map((c) => c.categoryId) } }, select: { id: true, slug: true } }),
      this.prisma.author.findMany({ where: { id: { in: authors.map((a) => a.authorId) } }, select: { id: true, slug: true, name: true } }),
    ]);
    const categorySlug = new Map(categoryRows.map((c) => [c.id, c.slug]));
    const author = new Map(authorRows.map((a) => [a.id, a]));
    return {
      categories: categories
        .map((c) => ({ slug: categorySlug.get(c.categoryId)!, count: c._count._all }))
        .sort((a, b) => b.count - a.count),
      languages: languages.map((l) => ({ code: l.language, count: l._count._all })),
      authors: authors.map((a) => ({ slug: author.get(a.authorId)!.slug, name: author.get(a.authorId)!.name, count: a._count._all })),
      catalogTotal,
    };
  }

  async detail(slug: string): Promise<BookDetailDto> {
    const book = await this.prisma.book.findUnique({ where: { slug }, include: bookInclude });
    if (!book) throw new NotFoundException('Book not found');
    return toBookDetail(book, this.supabase);
  }

  async related(slug: string): Promise<RelatedBooksDto> {
    const book = await this.prisma.book.findUnique({
      where: { slug },
      select: { id: true, authors: { select: { authorId: true } }, categories: { select: { categoryId: true } } },
    });
    if (!book) throw new NotFoundException('Book not found');
    const authorIds = book.authors.map((a) => a.authorId);

    // Readers who borrowed or reserved this book, and what else they took out, most shared first.
    const coBorrowed = await this.prisma.$queryRaw<{ book_id: string }[]>`
      WITH readers AS (
        SELECT l.member_id FROM loans l JOIN book_copies c ON c.id = l.copy_id WHERE c.book_id = ${book.id}::uuid
        UNION
        SELECT member_id FROM reservations WHERE book_id = ${book.id}::uuid
      ), taken AS (
        SELECT c.book_id, l.member_id FROM loans l JOIN book_copies c ON c.id = l.copy_id
        UNION
        SELECT book_id, member_id FROM reservations
      )
      SELECT t.book_id FROM taken t JOIN readers r ON r.member_id = t.member_id
      WHERE t.book_id <> ${book.id}::uuid
      GROUP BY t.book_id
      ORDER BY count(DISTINCT t.member_id) DESC
      LIMIT 5`;

    const [moreByAuthor, coBooks] = await Promise.all([
      this.prisma.book.findMany({
        where: { id: { not: book.id }, authors: { some: { authorId: { in: authorIds } } } },
        orderBy: [{ publishedYear: { sort: 'asc', nulls: 'last' } }, { title: 'asc' }],
        include: bookInclude,
        take: 4,
      }),
      this.prisma.book.findMany({ where: { id: { in: coBorrowed.map((r) => r.book_id) } }, include: bookInclude }),
    ]);
    const byId = new Map(coBooks.map((b) => [b.id, b]));
    const alsoBorrowed = coBorrowed.map((r) => byId.get(r.book_id)!).filter(Boolean);

    if (alsoBorrowed.length < 5) {
      const exclude = [book.id, ...moreByAuthor.map((b) => b.id), ...alsoBorrowed.map((b) => b.id)];
      const sameSubject = await this.prisma.book.findMany({
        where: {
          id: { notIn: exclude },
          categories: { some: { categoryId: { in: book.categories.map((c) => c.categoryId) } } },
          authors: { none: { authorId: { in: authorIds } } },
        },
        orderBy: { reservations: { _count: 'desc' } },
        include: bookInclude,
        take: 5 - alsoBorrowed.length,
      });
      alsoBorrowed.push(...sameSubject);
    }

    return {
      moreByAuthor: moreByAuthor.map((b) => toBookSummary(b, this.supabase)),
      alsoBorrowed: alsoBorrowed.map((b) => toBookSummary(b, this.supabase)),
    };
  }

  /** Published collections in page order, each with its size and first three books. */
  async collections(): Promise<CollectionSummaryDto[]> {
    const rows = await this.prisma.collection.findMany({
      where: { isPublished: true },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: { select: { items: true } },
        items: { orderBy: { position: 'asc' }, take: 3, include: { book: { include: bookInclude } } },
      },
    });
    return rows.map((c) => ({
      ...collectionFields(c),
      bookCount: c._count.items,
      covers: c.items.map(({ book }) => toBookSummary(book, this.supabase)),
    }));
  }

  async collection(slug: string): Promise<CollectionDto> {
    const collection = await this.prisma.collection.findFirst({
      where: { slug, isPublished: true },
      include: { items: { orderBy: { position: 'asc' }, include: { book: { include: bookInclude } } } },
    });
    if (!collection) throw new NotFoundException('Collection not found');
    return {
      ...collectionFields(collection),
      bookCount: collection.items.length,
      books: collection.items.map(({ book }) => toBookSummary(book, this.supabase)),
    };
  }

  /** Most borrowed books in the last `days`; new reservations count too, so demand shows before checkout. */
  async popular({ days, limit }: PopularBooksQuery): Promise<PopularBookDto[]> {
    const since = new Date(Date.now() - days * 86_400_000);
    const top = await this.prisma.$queryRaw<{ book_id: string; loans: bigint }[]>`
      SELECT book_id, sum(loans) AS loans, sum(score) AS score FROM (
        SELECT c.book_id, count(*) AS loans, count(*) AS score
        FROM loans l JOIN book_copies c ON c.id = l.copy_id
        WHERE l.checked_out_at >= ${since}
        GROUP BY c.book_id
        UNION ALL
        SELECT book_id, 0, count(*)
        FROM reservations
        WHERE created_at >= ${since} AND status <> 'FULFILLED'
        GROUP BY book_id
      ) demand
      GROUP BY book_id
      ORDER BY score DESC, loans DESC
      LIMIT ${limit}`;
    const books = await this.prisma.book.findMany({ where: { id: { in: top.map((t) => t.book_id) } }, include: bookInclude });
    const byId = new Map(books.map((b) => [b.id, b]));
    return top.map((t) => ({ book: toBookSummary(byId.get(t.book_id)!, this.supabase), loans: Number(t.loans) }));
  }

  async categories(): Promise<CategoryDto[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ position: 'asc' }, { nameEn: 'asc' }],
      include: { _count: { select: { books: true } } },
    });
    return rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      nameTr: c.nameTr,
      nameEn: c.nameEn,
      parentId: c.parentId,
      bookCount: c._count.books,
    }));
  }
}

function searchTerms(query: CatalogQuery): string[] {
  return query.q ? foldForSearch(query.q).split(' ').filter(Boolean) : [];
}

/** The catalog filters as a Prisma where clause; `omit` leaves one filter out for its facet counts. */
function buildWhere(query: CatalogQuery, omit?: 'category' | 'author' | 'language'): Prisma.BookWhereInput {
  const and: Prisma.BookWhereInput[] = searchTerms(query).map((term) => ({ searchText: { contains: term } }));
  if (query.ids) and.push({ id: { in: query.ids } });
  if (query.category?.length && omit !== 'category') and.push({ categories: { some: { category: { slug: { in: query.category } } } } });
  if (query.author?.length && omit !== 'author') and.push({ authors: { some: { author: { slug: { in: query.author } } } } });
  if (query.language?.length && omit !== 'language') and.push({ language: { in: query.language } });
  if (query.available) and.push({ copies: { some: { status: 'AVAILABLE' } } });
  if (query.yearFrom) and.push({ publishedYear: { gte: query.yearFrom } });
  if (query.yearTo) and.push({ publishedYear: { lte: query.yearTo } });
  return { AND: and };
}

function collectionFields(c: Collection): Omit<CollectionSummaryDto, 'bookCount' | 'covers'> {
  return {
    slug: c.slug,
    kind: c.kind,
    titleTr: c.titleTr,
    titleEn: c.titleEn,
    descriptionTr: c.descriptionTr,
    descriptionEn: c.descriptionEn,
    curatorTr: c.curatorTr,
    curatorEn: c.curatorEn,
    featured: c.isFeatured,
  };
}
