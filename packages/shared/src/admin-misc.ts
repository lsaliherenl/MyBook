import { z } from 'zod';
import { BOOK_PROVIDERS, type BookProvider, type BookSummaryDto, type CategoryDto } from './catalog.js';
import { EVENT_KINDS, type EventDetails, type EventDto } from './events.js';

// ─── Event management (B18) ──────────────────────────────────────────────────

export const ADMIN_EVENT_LISTS = ['upcoming', 'drafts', 'past'] as const;
export type AdminEventList = (typeof ADMIN_EVENT_LISTS)[number];

export interface AdminEventDto extends EventDto {
  published: boolean;
  details: EventDetails;
  bookId: string | null;
}

export interface AdminEventListDto {
  items: AdminEventDto[];
  counts: Record<AdminEventList, number>;
}

export interface EventAttendeeDto {
  memberId: string;
  fullName: string;
  email: string;
  waitlisted: boolean;
  registeredAt: string;
}

const optionalText = (max: number) => z.string().trim().max(max).nullish();

/** Create or update an event. Times are full ISO instants; the web form converts from Istanbul time. */
export const saveEventSchema = z
  .object({
    kind: z.enum(EVENT_KINDS),
    titleTr: z.string().trim().min(2).max(200),
    titleEn: z.string().trim().min(2).max(200),
    descriptionTr: optionalText(4000),
    descriptionEn: optionalText(4000),
    locationTr: z.string().trim().min(2).max(200),
    locationEn: z.string().trim().min(2).max(200),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }).nullish(),
    rsvpRequired: z.boolean(),
    /** Null means open seating. */
    capacity: z.number().int().min(1).max(2000).nullish(),
    published: z.boolean(),
  })
  .refine((v) => !v.endsAt || new Date(v.endsAt) > new Date(v.startsAt), { message: 'The event must end after it starts', path: ['endsAt'] });
export type SaveEventInput = z.infer<typeof saveEventSchema>;

// ─── Reports (B19) ───────────────────────────────────────────────────────────

export const REPORT_RANGES = ['week', 'month', 'term', 'year'] as const;
export type ReportRange = (typeof REPORT_RANGES)[number];

export interface ReportSummaryDto {
  range: ReportRange;
  from: string;
  to: string;
  loans: number;
  /** The same span right before this one, for the trend. */
  loansBefore: number;
  returnedOnTimePct: number | null;
  returnedOnTimePctBefore: number | null;
  activeReaders: number;
  members: number;
  finesCollected: number;
  finesWaived: number;
  /** The last 12 calendar months (library time), oldest first, with the year before for comparison. */
  months: { month: string; loans: number; previousYear: number }[];
  categories: { category: Pick<CategoryDto, 'slug' | 'nameTr' | 'nameEn'> | null; loans: number }[];
  topBooks: { book: BookSummaryDto; loans: number; copies: number }[];
}

// ─── Integrations (B20) ──────────────────────────────────────────────────────

export interface IntegrationDto {
  id: BookProvider | 'SUPABASE';
  kind: 'books' | 'platform';
  configured: boolean;
}

export interface IntegrationTestDto {
  id: IntegrationDto['id'];
  ok: boolean;
  ms: number;
  /** Results of the test search, or books in the database for Supabase. */
  count: number | null;
  error: string | null;
}

export const integrationIdSchema = z.enum([...BOOK_PROVIDERS, 'SUPABASE']);
