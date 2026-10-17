import { z } from 'zod';

// ─── Catalog (public) ────────────────────────────────────────────────────────

export const CATALOG_SORTS = ['relevance', 'title', 'newest', 'popular'] as const;

/** "a,b,c" in the query string → ["a", "b", "c"]; filters accept several values at once. */
const listFromQuery = (item: z.ZodString, max: number) =>
  z
    .string()
    .transform((s) => s.split(',').map((v) => v.trim()).filter(Boolean))
    .pipe(z.array(item).max(max));

const booleanFromQuery = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .or(z.boolean());

export const catalogQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  /** Comma-separated book IDs, e.g. the borrow bag's contents. */
  ids: z
    .string()
    .transform((s) => s.split(',').filter(Boolean))
    .pipe(z.array(z.uuid()).max(10))
    .optional(),
  /** Category slugs; a book matches if it is in any of them. */
  category: listFromQuery(z.string().max(80), 20).optional(),
  /** Author slugs. */
  author: listFromQuery(z.string().max(120), 20).optional(),
  /** ISO 639-1 codes. */
  language: listFromQuery(z.string().length(2), 10).optional(),
  available: booleanFromQuery.optional(),
  yearFrom: z.coerce.number().int().min(0).max(3000).optional(),
  yearTo: z.coerce.number().int().min(0).max(3000).optional(),
  sort: z.enum(CATALOG_SORTS).default('relevance'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(24),
});
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

export interface CatalogFacetsDto {
  /** Counts ignore the facet's own filter, so picking one category still shows the others' counts. */
  categories: { slug: string; count: number }[];
  languages: { code: string; count: number }[];
  /** The authors with the most matching books. */
  authors: { slug: string; name: string; count: number }[];
  /** Books in the whole catalog, for the "48,210 books" line. */
  catalogTotal: number;
}

export interface CategoryDto {
  id: string;
  slug: string;
  nameTr: string;
  nameEn: string;
  parentId: string | null;
  bookCount?: number;
}

export interface AuthorRefDto {
  name: string;
  slug: string;
}

export interface AvailabilityDto {
  total: number;
  available: number;
  onLoan: number;
  onHold: number;
  /** Members queued for the next copy that frees up. */
  waiting: number;
  /** Earliest due date among copies on loan, when none is on the shelf. */
  nextDueAt: string | null;
}

export interface BookSummaryDto {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  authors: AuthorRefDto[];
  coverUrl: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
  language: string;
  publishedYear: number | null;
  categories: Pick<CategoryDto, 'slug' | 'nameTr' | 'nameEn'>[];
  availability: AvailabilityDto;
}

export interface BookDetailDto extends BookSummaryDto {
  description: string | null;
  isbn13: string | null;
  isbn10: string | null;
  publisher: string | null;
  pageCount: number | null;
  shelfLocations: string[];
  /** Every copy in the collection, in barcode order; barcodes stay internal. */
  copies: { status: 'AVAILABLE' | 'ON_HOLD' | 'ON_LOAN' | 'IN_REPAIR'; shelfLocation: string | null; dueAt: string | null }[];
}

export interface RelatedBooksDto {
  moreByAuthor: BookSummaryDto[];
  /** Books borrowed or reserved by readers of this book; same-subject books fill the gaps. */
  alsoBorrowed: BookSummaryDto[];
}

export interface CollectionDto {
  slug: string;
  titleTr: string;
  titleEn: string;
  descriptionTr: string | null;
  descriptionEn: string | null;
  books: BookSummaryDto[];
}

export const popularBooksQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(24).default(5),
});
export type PopularBooksQuery = z.infer<typeof popularBooksQuerySchema>;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ─── Import from external book APIs (librarian) ──────────────────────────────

export const BOOK_PROVIDERS = ['GOOGLE_BOOKS', 'OPEN_LIBRARY', 'APPLE_BOOKS'] as const;
export type BookProvider = (typeof BOOK_PROVIDERS)[number];

export interface CoverCandidate {
  provider: BookProvider;
  url: string;
  /** Known up front for some providers; otherwise measured when the cover is imported. */
  width: number | null;
  height: number | null;
}

export interface ExternalBookCandidate {
  provider: BookProvider;
  externalId: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  language: string | null;
  description: string | null;
  isbn13: string | null;
  isbn10: string | null;
  /** Subject labels as the provider returns them; shown as hints only. */
  rawCategories: string[];
  covers: CoverCandidate[];
}

export interface ImportSearchResult {
  candidates: ExternalBookCandidate[];
  /** Covers from other providers that look like the same book, best first. */
  extraCovers: CoverCandidate[];
  /** Providers that failed or timed out; the search still returns what the others found. */
  errors: { provider: BookProvider; message: string }[];
  /** ISBN-13 of a book already in the catalog that matches, if any. */
  existingBookId: string | null;
}

const isbn13 = z.string().regex(/^97[89][0-9]{10}$/, 'ISBN-13');
const isbn10 = z.string().regex(/^[0-9]{9}[0-9X]$/, 'ISBN-10');

export const importSearchSchema = z
  .object({
    q: z.string().trim().min(2).max(200).optional(),
    isbn: z
      .string()
      .transform((s) => s.replace(/[^0-9X]/gi, '').toUpperCase())
      .pipe(isbn13.or(isbn10))
      .optional(),
  })
  .refine((v) => Boolean(v.q) !== Boolean(v.isbn), { message: 'Provide either q or isbn' });
export type ImportSearchInput = z.infer<typeof importSearchSchema>;

export const importBookSchema = z.object({
  title: z.string().trim().min(1).max(300),
  subtitle: z.string().trim().max(300).nullish(),
  authors: z.array(z.string().trim().min(1).max(150)).min(1).max(10),
  publisher: z.string().trim().max(200).nullish(),
  publishedYear: z.number().int().min(0).max(3000).nullish(),
  pageCount: z.number().int().positive().max(20000).nullish(),
  language: z.string().trim().length(2),
  description: z.string().trim().max(10000).nullish(),
  isbn13: isbn13.nullish(),
  isbn10: isbn10.nullish(),
  categoryIds: z.array(z.uuid()).max(5).default([]),
  cover: z
    .object({
      url: z.url({ protocol: /^https$/ }),
      provider: z.enum(BOOK_PROVIDERS),
    })
    .nullish(),
  externalIds: z
    .object({
      googleVolumeId: z.string().max(64).nullish(),
      openLibraryId: z.string().max(64).nullish(),
      appleTrackId: z.string().max(64).nullish(),
    })
    .default({}),
  copies: z.object({
    count: z.number().int().min(1).max(50),
    shelfLocation: z.string().trim().max(40).nullish(),
  }),
});
export type ImportBookInput = z.infer<typeof importBookSchema>;
