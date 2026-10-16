import { Injectable, NotFoundException } from '@nestjs/common';
import { foldForSearch, type BookDetailDto, type BookSummaryDto, type CatalogQuery, type CategoryDto, type Paginated } from '@mybook/shared';
import type { Prisma } from '../generated/prisma/client.js';
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
    const and: Prisma.BookWhereInput[] = [];
    const terms = query.q ? foldForSearch(query.q).split(' ').filter(Boolean) : [];
    for (const term of terms) and.push({ searchText: { contains: term } });
    if (query.category) and.push({ categories: { some: { category: { slug: query.category } } } });
    if (query.author) and.push({ authors: { some: { author: { slug: query.author } } } });
    if (query.language) and.push({ language: query.language });
    if (query.available) and.push({ copies: { some: { status: 'AVAILABLE' } } });
    if (query.yearFrom) and.push({ publishedYear: { gte: query.yearFrom } });
    if (query.yearTo) and.push({ publishedYear: { lte: query.yearTo } });
    const where: Prisma.BookWhereInput = { AND: and };

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

  async detail(slug: string): Promise<BookDetailDto> {
    const book = await this.prisma.book.findUnique({ where: { slug }, include: bookInclude });
    if (!book) throw new NotFoundException('Book not found');
    return toBookDetail(book, this.supabase);
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
