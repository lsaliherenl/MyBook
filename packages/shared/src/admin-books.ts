import { z } from 'zod';
import { BOOK_PROVIDERS, type AuthorRefDto, type CategoryDto } from './catalog.js';
import type { CopyStatus } from './circulation.js';

// ─── Book list (B15) ─────────────────────────────────────────────────────────

export const ADMIN_BOOK_FILTERS = ['all', 'available', 'out', 'holds', 'repair'] as const;
export type AdminBookFilter = (typeof ADMIN_BOOK_FILTERS)[number];

export const adminBooksQuerySchema = z.object({
  /** Title, author, ISBN or shelf code. */
  q: z.string().trim().max(200).optional(),
  category: z.string().max(80).optional(),
  filter: z.enum(ADMIN_BOOK_FILTERS).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminBooksQuery = z.infer<typeof adminBooksQuerySchema>;

export interface AdminBookRowDto {
  id: string;
  slug: string;
  title: string;
  authors: AuthorRefDto[];
  publishedYear: number | null;
  language: string;
  isbn13: string | null;
  coverUrl: string | null;
  categories: Pick<CategoryDto, 'slug' | 'nameTr' | 'nameEn'>[];
  shelves: string[];
  /** Copies in the collection (lost and withdrawn ones not counted). */
  total: number;
  available: number;
  onLoan: number;
  inRepair: number;
  /** Open reservations: waiting in line or held at the desk. */
  reserved: number;
}

export interface AdminBookListDto {
  items: AdminBookRowDto[];
  total: number;
  page: number;
  pageSize: number;
  /** Titles per filter chip, for the current search and category. */
  counts: Record<AdminBookFilter, number>;
  /** The whole catalog, for the page subtitle. */
  catalog: { titles: number; copies: number };
}

/** One change applied to every selected title. */
export const bulkBooksSchema = z
  .object({
    bookIds: z.array(z.uuid()).min(1).max(100),
    /** Every circulating copy moves to this shelf. */
    shelfLocation: z.string().trim().min(1).max(40).optional(),
    /** Replaces the titles' categories with this one. */
    categoryId: z.uuid().optional(),
    /** Takes every copy on the shelf out of circulation; copies out on loan follow when returned. */
    withdraw: z.literal(true).optional(),
  })
  .refine((v) => [v.shelfLocation, v.categoryId, v.withdraw].filter((x) => x !== undefined).length === 1, {
    message: 'Choose exactly one change',
  });
export type BulkBooksInput = z.infer<typeof bulkBooksSchema>;

// ─── One book (B15 edit) ─────────────────────────────────────────────────────

export const COPY_CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'POOR'] as const;
export type CopyCondition = (typeof COPY_CONDITIONS)[number];

export interface AdminCopyDto {
  id: string;
  barcode: string;
  status: CopyStatus;
  condition: CopyCondition;
  shelfLocation: string | null;
  acquiredAt: string;
  loanCount: number;
  /** Who has or is about to collect the copy. */
  holder: { memberId: string; memberName: string; dueAt: string | null; expiresAt: string | null; reservationCode: string | null } | null;
}

export interface AdminBookDto {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  isbn13: string | null;
  isbn10: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  language: string;
  description: string | null;
  categoryIds: string[];
  cover: { url: string; width: number | null; height: number | null; source: string | null } | null;
  copies: AdminCopyDto[];
  waiting: number;
  createdAt: string;
}

export const updateBookSchema = z.object({
  title: z.string().trim().min(1).max(300),
  subtitle: z.string().trim().max(300).nullish(),
  authors: z.array(z.string().trim().min(1).max(150)).min(1).max(10),
  publisher: z.string().trim().max(200).nullish(),
  isbn13: z.string().regex(/^97[89][0-9]{10}$/, 'ISBN-13').nullish(),
  isbn10: z.string().regex(/^[0-9]{9}[0-9X]$/, 'ISBN-10').nullish(),
  publishedYear: z.number().int().min(0).max(3000).nullish(),
  pageCount: z.number().int().positive().max(20000).nullish(),
  language: z.string().trim().length(2),
  description: z.string().trim().max(10000).nullish(),
  categoryIds: z.array(z.uuid()).max(5),
});
export type UpdateBookInput = z.infer<typeof updateBookSchema>;

export const addCopiesSchema = z.object({
  count: z.number().int().min(1).max(50),
  shelfLocation: z.string().trim().max(40).nullish(),
});
export type AddCopiesInput = z.infer<typeof addCopiesSchema>;

/** Statuses a librarian may set by hand; loans and holds change only through circulation. */
export const MANUAL_COPY_STATUSES = ['AVAILABLE', 'IN_REPAIR', 'LOST', 'WITHDRAWN'] as const;

export const updateCopySchema = z
  .object({
    condition: z.enum(COPY_CONDITIONS).optional(),
    shelfLocation: z.string().trim().max(40).nullable().optional(),
    status: z.enum(MANUAL_COPY_STATUSES).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to change' });
export type UpdateCopyInput = z.infer<typeof updateCopySchema>;

export const replaceCoverSchema = z.object({
  url: z.url({ protocol: /^https$/ }),
  provider: z.enum(BOOK_PROVIDERS),
});

export interface CopyHistoryDto {
  memberId: string;
  memberName: string;
  checkedOutAt: string;
  dueAt: string;
  returnedAt: string | null;
  daysOverdue: number;
  fine: number | null;
  renewCount: number;
}

export interface BookActivityDto {
  at: string;
  kind: 'import' | 'edit' | 'copies' | 'checkout' | 'return' | 'reserve' | 'copy';
  /** Who did it (staff member or the member reserving). */
  actor: string | null;
  /** Kind-specific facts for the sentence the UI writes, e.g. { barcode, member, count }. */
  data: Record<string, string | number | null>;
}

// ─── Import (B16) ────────────────────────────────────────────────────────────

/** Bulk import: one CSV row at a time, with sensible picks made for the librarian. */
export const importIsbnSchema = z.object({
  isbn: z.string().trim().max(40),
  copies: z.number().int().min(1).max(50).default(1),
  shelfLocation: z.string().trim().max(40).nullish(),
});
export type ImportIsbnInput = z.input<typeof importIsbnSchema>;

export type ImportIsbnStatus = 'imported' | 'no_cover' | 'copies_added' | 'not_found' | 'invalid' | 'failed';

export interface ImportIsbnResultDto {
  isbn: string;
  status: ImportIsbnStatus;
  bookId: string | null;
  title: string | null;
}
