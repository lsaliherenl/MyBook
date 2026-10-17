import { ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import {
  foldForSearch,
  slugify,
  type AddCopiesInput,
  type AdminBookDto,
  type AdminBookListDto,
  type AdminBookRowDto,
  type AdminBooksQuery,
  type BookActivityDto,
  type BookProvider,
  type BulkBooksInput,
  type CopyHistoryDto,
  type ExternalBookCandidate,
  type ImportIsbnInput,
  type ImportIsbnResultDto,
  type UpdateBookInput,
  type UpdateCopyInput,
} from '@mybook/shared';
import { randomBytes } from 'node:crypto';
import type { AuthUser } from '../auth/auth.types.js';
import { Prisma } from '../generated/prisma/client.js';
import { Clock } from '../circulation/clock.js';
import { loadSettings, releaseCopy } from '../circulation/holds.js';
import { daysOverdue } from '../circulation/rules.js';
import { CoverService } from '../import/cover.service.js';
import { ImportService } from '../import/import.service.js';
import { isbn10To13 } from '../import/matching.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { COVERS_BUCKET, SupabaseService } from '../supabase/supabase.service.js';

const TX_OPTIONS = { timeout: 20_000, maxWait: 10_000 };

/** A refused catalog change, with a stable code the web app translates. */
export class BookAdminException extends HttpException {
  constructor(readonly code: 'isbn_taken' | 'copy_in_circulation') {
    super({ statusCode: 409, error: 'Books', code, message: code }, HttpStatus.CONFLICT);
  }
}

interface StatsRow {
  id: string;
  total: bigint;
  available: bigint;
  on_loan: bigint;
  in_repair: bigint;
  reserved: bigint;
}

/** Librarian catalog management: the book table, editing a record, its copies, covers and ISBN imports. */
@Injectable()
export class BooksAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly imports: ImportService,
    private readonly covers: CoverService,
    private readonly clock: Clock,
  ) {}

  // ─── List ──────────────────────────────────────────────────────────────────

  async list(query: AdminBooksQuery): Promise<AdminBookListDto> {
    const where: Prisma.Sql[] = [];
    const q = query.q?.trim();
    if (q) {
      const folded = `%${foldForSearch(q)}%`;
      const code = q.toUpperCase();
      where.push(Prisma.sql`(
        b.search_text LIKE ${folded}
        OR EXISTS (SELECT 1 FROM book_copies sc WHERE sc.book_id = b.id AND (upper(sc.shelf_location) LIKE ${`${code}%`} OR sc.barcode = ${code}))
      )`);
    }
    if (query.category) {
      where.push(Prisma.sql`EXISTS (
        SELECT 1 FROM book_categories bc JOIN categories cat ON cat.id = bc.category_id
        WHERE bc.book_id = b.id AND cat.slug = ${query.category}
      )`);
    }
    const whereSql = where.length ? Prisma.sql`WHERE ${Prisma.join(where, ' AND ')}` : Prisma.empty;
    const stats = Prisma.sql`
      SELECT b.id, b.title,
        count(c.id) FILTER (WHERE c.status NOT IN ('LOST', 'WITHDRAWN')) AS total,
        count(c.id) FILTER (WHERE c.status = 'AVAILABLE') AS available,
        count(c.id) FILTER (WHERE c.status = 'ON_LOAN') AS on_loan,
        count(c.id) FILTER (WHERE c.status = 'IN_REPAIR') AS in_repair,
        (SELECT count(*) FROM reservations r WHERE r.book_id = b.id AND r.status IN ('PENDING', 'READY')) AS reserved
      FROM books b LEFT JOIN book_copies c ON c.book_id = b.id
      ${whereSql}
      GROUP BY b.id`;
    const filters: Record<AdminBooksQuery['filter'], Prisma.Sql> = {
      all: Prisma.sql`TRUE`,
      available: Prisma.sql`available > 0`,
      out: Prisma.sql`total > 0 AND available = 0`,
      holds: Prisma.sql`reserved > 0`,
      repair: Prisma.sql`in_repair > 0`,
    };

    const [counts] = await this.prisma.$queryRaw<Record<AdminBooksQuery['filter'], bigint>[]>`
      WITH s AS (${stats})
      SELECT count(*) AS "all",
        count(*) FILTER (WHERE ${filters.available}) AS available,
        count(*) FILTER (WHERE ${filters.out}) AS "out",
        count(*) FILTER (WHERE ${filters.holds}) AS holds,
        count(*) FILTER (WHERE ${filters.repair}) AS repair
      FROM s`;
    const rows = await this.prisma.$queryRaw<StatsRow[]>`
      WITH s AS (${stats})
      SELECT id, total, available, on_loan, in_repair, reserved FROM s
      WHERE ${filters[query.filter]}
      ORDER BY title, id
      LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`;

    const books = await this.prisma.book.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      include: {
        authors: { include: { author: true }, orderBy: { position: 'asc' } },
        categories: { include: { category: true } },
        copies: { select: { shelfLocation: true, status: true } },
      },
    });
    const byId = new Map(books.map((b) => [b.id, b]));
    const items: AdminBookRowDto[] = rows.map((r) => {
      const b = byId.get(r.id)!;
      const shelves = b.copies.filter((c) => c.status !== 'WITHDRAWN' && c.status !== 'LOST').map((c) => c.shelfLocation);
      return {
        id: b.id,
        slug: b.slug,
        title: b.title,
        authors: b.authors.map(({ author }) => ({ name: author.name, slug: author.slug })),
        publishedYear: b.publishedYear,
        language: b.language,
        isbn13: b.isbn13,
        coverUrl: b.coverPath ? this.supabase.publicUrl(COVERS_BUCKET, b.coverPath) : null,
        categories: b.categories.map(({ category: c }) => ({ slug: c.slug, nameTr: c.nameTr, nameEn: c.nameEn })),
        shelves: [...new Set(shelves.filter((s): s is string => Boolean(s)))].sort(),
        total: Number(r.total),
        available: Number(r.available),
        onLoan: Number(r.on_loan),
        inRepair: Number(r.in_repair),
        reserved: Number(r.reserved),
      };
    });

    const titles = await this.prisma.book.count();
    const copies = await this.prisma.bookCopy.count({ where: { status: { notIn: ['LOST', 'WITHDRAWN'] } } });
    return {
      items,
      total: Number(counts[query.filter]),
      page: query.page,
      pageSize: query.pageSize,
      counts: {
        all: Number(counts.all),
        available: Number(counts.available),
        out: Number(counts.out),
        holds: Number(counts.holds),
        repair: Number(counts.repair),
      },
      catalog: { titles, copies },
    };
  }

  /** The current filter as CSV (UTF-8 with BOM so Excel shows Turkish letters). */
  async listCsv(query: AdminBooksQuery): Promise<string> {
    const rows: AdminBookRowDto[] = [];
    for (let page = 1; ; page++) {
      const result = await this.list({ ...query, page, pageSize: 100 });
      rows.push(...result.items);
      if (rows.length >= result.total || result.items.length === 0) break;
    }
    const header = ['title', 'authors', 'year', 'isbn13', 'categories', 'shelves', 'total', 'available', 'on_loan', 'in_repair', 'reserved'];
    const lines = rows.map((r) => [
      r.title,
      r.authors.map((a) => a.name).join('; '),
      r.publishedYear?.toString() ?? '',
      r.isbn13 ?? '',
      r.categories.map((c) => c.nameEn).join('; '),
      r.shelves.join('; '),
      String(r.total),
      String(r.available),
      String(r.onLoan),
      String(r.inRepair),
      String(r.reserved),
    ]);
    const escape = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    return '﻿' + [header, ...lines].map((line) => line.map(escape).join(',')).join('\r\n') + '\r\n';
  }

  async bulk(actor: AuthUser, input: BulkBooksInput): Promise<{ changed: number }> {
    const books = { bookId: { in: input.bookIds } };
    let changed = 0;
    await this.prisma.$transaction(async (tx) => {
      if (input.shelfLocation) {
        changed = (
          await tx.bookCopy.updateMany({ where: { ...books, status: { notIn: ['LOST', 'WITHDRAWN'] } }, data: { shelfLocation: input.shelfLocation } })
        ).count;
      } else if (input.categoryId) {
        await tx.bookCategory.deleteMany({ where: books });
        changed = (await tx.bookCategory.createMany({ data: input.bookIds.map((bookId) => ({ bookId, categoryId: input.categoryId! })) })).count;
      } else if (input.withdraw) {
        // Copies on loan or held for a reader stay in circulation until they come back.
        changed = (await tx.bookCopy.updateMany({ where: { ...books, status: { in: ['AVAILABLE', 'IN_REPAIR'] } }, data: { status: 'WITHDRAWN' } })).count;
      }
      await tx.auditLog.createMany({
        data: input.bookIds.map((id) => ({
          actorId: actor.id,
          action: 'book.bulk',
          entityType: 'book',
          entityId: id,
          data: { shelfLocation: input.shelfLocation ?? null, categoryId: input.categoryId ?? null, withdraw: input.withdraw ?? false },
        })),
      });
    }, TX_OPTIONS);
    return { changed };
  }

  // ─── One book ──────────────────────────────────────────────────────────────

  async get(bookId: string): Promise<AdminBookDto> {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      include: {
        authors: { include: { author: true }, orderBy: { position: 'asc' } },
        categories: true,
        publisher: true,
        copies: {
          orderBy: { barcode: 'asc' },
          include: {
            _count: { select: { loans: true } },
            loans: { where: { status: 'ACTIVE' }, include: { member: { select: { id: true, fullName: true } } } },
            reservations: { where: { status: 'READY' }, include: { member: { select: { id: true, fullName: true } } } },
          },
        },
        _count: { select: { reservations: { where: { status: 'PENDING' } } } },
      },
    });
    if (!book) throw new NotFoundException('Book not found');
    return {
      id: book.id,
      slug: book.slug,
      title: book.title,
      subtitle: book.subtitle,
      authors: book.authors.map(({ author }) => author.name),
      publisher: book.publisher?.name ?? null,
      isbn13: book.isbn13,
      isbn10: book.isbn10,
      publishedYear: book.publishedYear,
      pageCount: book.pageCount,
      language: book.language,
      description: book.description,
      categoryIds: book.categories.map((c) => c.categoryId),
      cover: book.coverPath
        ? { url: this.supabase.publicUrl(COVERS_BUCKET, book.coverPath), width: book.coverWidth, height: book.coverHeight, source: book.coverSource }
        : null,
      copies: book.copies.map((c) => {
        const loan = c.loans[0];
        const hold = c.reservations[0];
        return {
          id: c.id,
          barcode: c.barcode,
          status: c.status,
          condition: c.condition,
          shelfLocation: c.shelfLocation,
          acquiredAt: c.acquiredAt.toISOString(),
          loanCount: c._count.loans,
          holder: loan
            ? { memberId: loan.member.id, memberName: loan.member.fullName, dueAt: loan.dueAt.toISOString(), expiresAt: null, reservationCode: null }
            : hold
              ? { memberId: hold.member.id, memberName: hold.member.fullName, dueAt: null, expiresAt: hold.expiresAt?.toISOString() ?? null, reservationCode: hold.code }
              : null,
        };
      }),
      waiting: book._count.reservations,
      createdAt: book.createdAt.toISOString(),
    };
  }

  async update(actor: AuthUser, bookId: string, input: UpdateBookInput): Promise<AdminBookDto> {
    const existing = await this.prisma.book.findUnique({ where: { id: bookId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Book not found');
    if (input.isbn13) {
      const other = await this.prisma.book.findUnique({ where: { isbn13: input.isbn13 }, select: { id: true } });
      if (other && other.id !== bookId) throw new BookAdminException('isbn_taken');
    }
    const authorIds = await this.authorIds(input.authors);
    const publisher = input.publisher
      ? await this.prisma.publisher.upsert({ where: { name: input.publisher }, create: { name: input.publisher }, update: {} })
      : null;
    const searchText = foldForSearch([input.title, input.subtitle, ...input.authors, input.isbn13, input.isbn10].filter(Boolean).join(' '));

    await this.prisma.$transaction(async (tx) => {
      await tx.book.update({
        where: { id: bookId },
        data: {
          title: input.title,
          subtitle: input.subtitle ?? null,
          description: input.description ?? null,
          language: input.language,
          publishedYear: input.publishedYear ?? null,
          pageCount: input.pageCount ?? null,
          isbn13: input.isbn13 ?? null,
          isbn10: input.isbn10 ?? null,
          publisherId: publisher?.id ?? null,
          searchText,
        },
      });
      await tx.bookAuthor.deleteMany({ where: { bookId } });
      await tx.bookAuthor.createMany({ data: authorIds.map((authorId, position) => ({ bookId, authorId, position })) });
      await tx.bookCategory.deleteMany({ where: { bookId } });
      await tx.bookCategory.createMany({ data: input.categoryIds.map((categoryId) => ({ bookId, categoryId })) });
      await tx.auditLog.create({ data: { actorId: actor.id, action: 'book.update', entityType: 'book', entityId: bookId } });
    }, TX_OPTIONS);
    return this.get(bookId);
  }

  /** New copies go straight to the next reader in line, or onto the shelf. */
  async addCopies(actor: AuthUser, bookId: string, input: AddCopiesInput): Promise<{ barcodes: string[] }> {
    const now = this.clock.now();
    const barcodes = await this.prisma.$transaction(async (tx) => {
      if (!(await tx.book.findUnique({ where: { id: bookId }, select: { id: true } }))) throw new NotFoundException('Book not found');
      const settings = await loadSettings(tx);
      const created: string[] = [];
      for (let i = 0; i < input.count; i++) {
        const copy = await tx.bookCopy.create({ data: { bookId, shelfLocation: input.shelfLocation ?? null, condition: 'NEW', acquiredAt: now } });
        await releaseCopy(tx, copy, now, settings);
        created.push(copy.barcode);
      }
      await tx.auditLog.create({
        data: { actorId: actor.id, action: 'book.copies', entityType: 'book', entityId: bookId, data: { count: input.count, barcodes: created } },
      });
      return created;
    }, TX_OPTIONS);
    return { barcodes };
  }

  async updateCopy(actor: AuthUser, copyId: string, input: UpdateCopyInput): Promise<AdminBookDto> {
    const now = this.clock.now();
    const bookId = await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM book_copies WHERE id = ${copyId}::uuid FOR UPDATE`;
      if (!locked) throw new NotFoundException('Copy not found');
      const copy = await tx.bookCopy.findUniqueOrThrow({ where: { id: copyId } });
      if (input.status && input.status !== copy.status && (copy.status === 'ON_LOAN' || copy.status === 'ON_HOLD')) {
        throw new BookAdminException('copy_in_circulation');
      }
      await tx.bookCopy.update({
        where: { id: copyId },
        data: {
          ...(input.condition ? { condition: input.condition } : {}),
          ...(input.shelfLocation !== undefined ? { shelfLocation: input.shelfLocation } : {}),
          ...(input.status && input.status !== 'AVAILABLE' ? { status: input.status } : {}),
        },
      });
      // Back on the shelf: someone may be waiting for it.
      if (input.status === 'AVAILABLE' && copy.status !== 'AVAILABLE') await releaseCopy(tx, copy, now, await loadSettings(tx));
      await tx.auditLog.create({
        data: { actorId: actor.id, action: 'copy.update', entityType: 'copy', entityId: copyId, data: { barcode: copy.barcode, ...input } },
      });
      return copy.bookId;
    }, TX_OPTIONS);
    return this.get(bookId);
  }

  async replaceCover(actor: AuthUser, bookId: string, url: string, provider: BookProvider): Promise<AdminBookDto> {
    if (!(await this.prisma.book.findUnique({ where: { id: bookId }, select: { id: true } }))) throw new NotFoundException('Book not found');
    const cover = await this.covers.store(bookId, url, provider);
    await this.prisma.book.update({
      where: { id: bookId },
      data: { coverPath: cover.path, coverWidth: cover.width, coverHeight: cover.height, coverSource: provider },
    });
    await this.prisma.auditLog.create({ data: { actorId: actor.id, action: 'book.cover', entityType: 'book', entityId: bookId, data: { provider } } });
    return this.get(bookId);
  }

  async copyHistory(copyId: string): Promise<CopyHistoryDto[]> {
    const now = this.clock.now();
    const loans = await this.prisma.loan.findMany({
      where: { copyId },
      orderBy: { checkedOutAt: 'desc' },
      take: 12,
      include: { member: { select: { id: true, fullName: true } }, fines: { select: { amount: true } } },
    });
    return loans.map((l) => ({
      memberId: l.member.id,
      memberName: l.member.fullName,
      checkedOutAt: l.checkedOutAt.toISOString(),
      dueAt: l.dueAt.toISOString(),
      returnedAt: l.returnedAt?.toISOString() ?? null,
      daysOverdue: daysOverdue(l.dueAt, l.returnedAt ?? now),
      fine: l.fines.length ? l.fines.reduce((sum, f) => sum + Number(f.amount), 0) : null,
      renewCount: l.renewCount,
    }));
  }

  /** What happened to the title: imports and edits, copies added, loans and reservations, newest first. */
  async activity(bookId: string, limit = 40): Promise<BookActivityDto[]> {
    const copies = await this.prisma.bookCopy.findMany({ where: { bookId }, select: { id: true, barcode: true } });
    const loans = await this.prisma.loan.findMany({
      where: { copyId: { in: copies.map((c) => c.id) } },
      select: { id: true, copy: { select: { barcode: true } }, member: { select: { fullName: true } } },
    });
    const loanById = new Map(loans.map((l) => [l.id, l]));
    const logs = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'book', entityId: bookId },
          { entityType: 'copy', entityId: { in: copies.map((c) => c.id) } },
          { entityType: 'loan', entityId: { in: loans.map((l) => l.id) }, action: { in: ['loan.checkout', 'loan.return'] } },
        ],
      },
      include: { actor: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const reservations = await this.prisma.reservation.findMany({
      where: { bookId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { createdAt: true, code: true, member: { select: { fullName: true } } },
    });

    const fromLogs = logs.map((log): BookActivityDto => {
      const d = (log.data ?? {}) as Record<string, unknown>;
      const actor = log.actor?.fullName ?? null;
      const at = log.createdAt.toISOString();
      switch (log.action) {
        case 'book.import':
          return { at, kind: 'import', actor, data: { count: Number(d.copies ?? 0) } };
        case 'book.copies':
          return { at, kind: 'copies', actor, data: { count: Number(d.count ?? 0) } };
        case 'copy.update':
          return { at, kind: 'copy', actor, data: { barcode: typeof d.barcode === 'string' ? d.barcode : '', status: (d.status as string) ?? null, condition: (d.condition as string) ?? null } };
        case 'loan.checkout':
        case 'loan.return': {
          const loan = loanById.get(log.entityId);
          return {
            at,
            kind: log.action === 'loan.checkout' ? 'checkout' : 'return',
            actor,
            data: { barcode: loan?.copy.barcode ?? null, member: loan?.member.fullName ?? null, fine: typeof d.fine === 'number' && d.fine > 0 ? d.fine : null },
          };
        }
        default:
          return { at, kind: 'edit', actor, data: { action: log.action } };
      }
    });
    const fromReservations: BookActivityDto[] = reservations.map((r) => ({
      at: r.createdAt.toISOString(),
      kind: 'reserve',
      actor: r.member.fullName,
      data: { code: r.code },
    }));
    return [...fromLogs, ...fromReservations].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  }

  // ─── Import (B16) ──────────────────────────────────────────────────────────

  /**
   * One row of a bulk import: looks the ISBN up in every source, merges what they know, picks the
   * best cover and saves the book — or adds copies when the ISBN is already in the catalog.
   */
  async importIsbn(actor: AuthUser, input: ImportIsbnInput): Promise<ImportIsbnResultDto> {
    const raw = input.isbn.replace(/[^0-9X]/gi, '').toUpperCase();
    const copies = { count: input.copies ?? 1, shelfLocation: input.shelfLocation ?? null };
    const result = (status: ImportIsbnResultDto['status'], bookId: string | null = null, title: string | null = null) => ({ isbn: raw || input.isbn, status, bookId, title });

    const isbn13 = /^97[89][0-9]{10}$/.test(raw) ? raw : /^[0-9]{9}[0-9X]$/.test(raw) ? isbn10To13(raw) : null;
    if (!isbn13) return result('invalid');

    const existing = await this.prisma.book.findUnique({ where: { isbn13 }, select: { id: true, title: true } });
    if (existing) {
      await this.addCopies(actor, existing.id, copies);
      return result('copies_added', existing.id, existing.title);
    }

    const found = await this.imports.search({ isbn: isbn13 });
    const candidates = rankCandidates(found.candidates);
    const best = candidates[0];
    if (!best) return result('not_found');
    const pick = <K extends keyof ExternalBookCandidate>(key: K) => candidates.map((c) => c[key]).find((v) => v !== null && v !== undefined && (!Array.isArray(v) || v.length > 0)) ?? null;
    const authors = (pick('authors') as string[] | null) ?? [];
    if (authors.length === 0) return result('not_found');

    const cover = [...found.candidates.flatMap((c) => c.covers), ...found.extraCovers].sort((a, b) => coverRank(b) - coverRank(a))[0] ?? null;
    try {
      const saved = await this.imports.importBook(
        {
          title: best.title,
          subtitle: (pick('subtitle') as string | null) ?? null,
          authors: authors.slice(0, 10),
          publisher: (pick('publisher') as string | null) ?? null,
          publishedYear: (pick('publishedYear') as number | null) ?? null,
          pageCount: (pick('pageCount') as number | null) ?? null,
          language: ((pick('language') as string | null) ?? 'tr').slice(0, 2),
          description: ((pick('description') as string | null) ?? null)?.slice(0, 10000) ?? null,
          isbn13,
          isbn10: /^[0-9]{9}[0-9X]$/.test(raw) ? raw : ((pick('isbn10') as string | null) ?? null),
          categoryIds: [],
          cover: cover ? { url: cover.url, provider: cover.provider } : null,
          externalIds: {
            googleVolumeId: found.candidates.find((c) => c.provider === 'GOOGLE_BOOKS')?.externalId ?? null,
            openLibraryId: found.candidates.find((c) => c.provider === 'OPEN_LIBRARY')?.externalId ?? null,
            appleTrackId: found.candidates.find((c) => c.provider === 'APPLE_BOOKS')?.externalId ?? null,
          },
          copies,
        },
        actor,
      );
      return result(saved.coverError || !cover ? 'no_cover' : 'imported', saved.book.id, saved.book.title);
    } catch (error) {
      if (error instanceof ConflictException) {
        const book = await this.prisma.book.findUnique({ where: { isbn13 }, select: { id: true, title: true } });
        return result('copies_added', book?.id ?? null, book?.title ?? null);
      }
      return result('failed', null, best.title);
    }
  }

  private async authorIds(names: string[]): Promise<string[]> {
    const ids: string[] = [];
    for (const name of names) {
      const slug = slugify(name) || randomBytes(3).toString('hex');
      const author = await this.prisma.author.upsert({ where: { slug }, create: { name, slug }, update: {} });
      if (!ids.includes(author.id)) ids.push(author.id);
    }
    return ids;
  }
}

/** Fullest record first: a candidate with authors, publisher, year, pages and a description beats a bare one. */
function rankCandidates(candidates: ExternalBookCandidate[]): ExternalBookCandidate[] {
  const score = (c: ExternalBookCandidate) =>
    (c.authors.length ? 4 : 0) + (c.publisher ? 1 : 0) + (c.publishedYear ? 1 : 0) + (c.pageCount ? 1 : 0) + (c.description ? 2 : 0) + (c.provider === 'APPLE_BOOKS' ? -1 : 0);
  return [...candidates].sort((a, b) => score(b) - score(a));
}

/** Apple's artwork is the sharpest, then Open Library; Google often has only a thumbnail. */
function coverRank(c: { provider: BookProvider; width: number | null }): number {
  const base = c.provider === 'APPLE_BOOKS' ? 3000 : c.provider === 'OPEN_LIBRARY' ? 2000 : 1000;
  return base + (c.width ?? 0) / 10;
}

