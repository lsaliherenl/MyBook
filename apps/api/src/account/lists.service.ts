import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FAVORITES_LIST_ID, type ReadingListDetailDto, type ReadingListDto } from '@mybook/shared';
import { bookInclude, toBookSummary } from '../catalog/book.mapper.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';

const MAX_LISTS = 30;

/**
 * A member's reading lists. "favorites" is a built-in list stored in the favorites table; its name is
 * left empty for the web app to translate.
 */
@Injectable()
export class ListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  async all(memberId: string): Promise<ReadingListDto[]> {
    const [favoriteCount, favorites, lists] = await Promise.all([
      this.prisma.favorite.count({ where: { memberId } }),
      this.prisma.favorite.findMany({ where: { memberId }, orderBy: { createdAt: 'desc' }, take: 3, include: { book: { include: bookInclude } } }),
      this.prisma.readingList.findMany({
        where: { memberId },
        orderBy: { createdAt: 'asc' },
        include: {
          _count: { select: { items: true } },
          items: { orderBy: { addedAt: 'desc' }, take: 3, include: { book: { include: bookInclude } } },
        },
      }),
    ]);
    return [
      { id: FAVORITES_LIST_ID, name: '', bookCount: favoriteCount, preview: favorites.map((f) => toBookSummary(f.book, this.supabase)) },
      ...lists.map((l) => ({
        id: l.id,
        name: l.name,
        bookCount: l._count.items,
        preview: l.items.map((i) => toBookSummary(i.book, this.supabase)),
      })),
    ];
  }

  async detail(memberId: string, listId: string): Promise<ReadingListDetailDto> {
    if (listId === FAVORITES_LIST_ID) {
      const favorites = await this.prisma.favorite.findMany({ where: { memberId }, orderBy: { createdAt: 'desc' }, include: { book: { include: bookInclude } } });
      return { id: FAVORITES_LIST_ID, name: '', books: favorites.map((f) => toBookSummary(f.book, this.supabase)) };
    }
    const list = await this.prisma.readingList.findFirst({
      where: { id: listId, memberId },
      include: { items: { orderBy: { addedAt: 'desc' }, include: { book: { include: bookInclude } } } },
    });
    if (!list) throw new NotFoundException('List not found');
    return { id: list.id, name: list.name, books: list.items.map((i) => toBookSummary(i.book, this.supabase)) };
  }

  async create(memberId: string, name: string): Promise<{ id: string }> {
    const count = await this.prisma.readingList.count({ where: { memberId } });
    if (count >= MAX_LISTS) throw new BadRequestException(`At most ${MAX_LISTS} lists`);
    return this.prisma.readingList.create({ data: { memberId, name }, select: { id: true } });
  }

  async rename(memberId: string, listId: string, name: string): Promise<void> {
    const { count } = await this.prisma.readingList.updateMany({ where: { id: listId, memberId }, data: { name } });
    if (!count) throw new NotFoundException('List not found');
  }

  async remove(memberId: string, listId: string): Promise<void> {
    const { count } = await this.prisma.readingList.deleteMany({ where: { id: listId, memberId } });
    if (!count) throw new NotFoundException('List not found');
  }

  async addBook(memberId: string, listId: string, bookId: string): Promise<void> {
    await this.assertBook(bookId);
    if (listId === FAVORITES_LIST_ID) {
      await this.prisma.favorite.upsert({ where: { memberId_bookId: { memberId, bookId } }, create: { memberId, bookId }, update: {} });
      return;
    }
    await this.assertOwn(memberId, listId);
    await this.prisma.readingListItem.upsert({ where: { listId_bookId: { listId, bookId } }, create: { listId, bookId }, update: {} });
  }

  async removeBook(memberId: string, listId: string, bookId: string): Promise<void> {
    if (listId === FAVORITES_LIST_ID) {
      await this.prisma.favorite.deleteMany({ where: { memberId, bookId } });
      return;
    }
    await this.assertOwn(memberId, listId);
    await this.prisma.readingListItem.deleteMany({ where: { listId, bookId } });
  }

  /** IDs of the member's lists that already hold the book, for the "Save to a list" menu. */
  async containing(memberId: string, bookId: string): Promise<string[]> {
    const [favorite, items] = await Promise.all([
      this.prisma.favorite.findUnique({ where: { memberId_bookId: { memberId, bookId } }, select: { bookId: true } }),
      this.prisma.readingListItem.findMany({ where: { bookId, list: { memberId } }, select: { listId: true } }),
    ]);
    return [...(favorite ? [FAVORITES_LIST_ID] : []), ...items.map((i) => i.listId)];
  }

  private async assertOwn(memberId: string, listId: string) {
    const list = await this.prisma.readingList.findFirst({ where: { id: listId, memberId }, select: { id: true } });
    if (!list) throw new NotFoundException('List not found');
  }

  private async assertBook(bookId: string) {
    const book = await this.prisma.book.findUnique({ where: { id: bookId }, select: { id: true } });
    if (!book) throw new NotFoundException('Book not found');
  }
}
