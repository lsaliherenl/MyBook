import { z } from 'zod';
import type { BookSummaryDto } from './catalog.js';
import type { LoanDto } from './circulation.js';

// ─── Reading lists ───────────────────────────────────────────────────────────

/** The built-in list backed by favorites; every other list has a UUID. */
export const FAVORITES_LIST_ID = 'favorites';

export const readingListNameSchema = z.object({ name: z.string().trim().min(1).max(80) });
export type ReadingListNameInput = z.infer<typeof readingListNameSchema>;

export interface ReadingListDto {
  id: string;
  name: string;
  bookCount: number;
  /** Up to three books for the fanned covers on the list card. */
  preview: BookSummaryDto[];
}

export interface ReadingListDetailDto {
  id: string;
  name: string;
  books: BookSummaryDto[];
}

// ─── Reading history ─────────────────────────────────────────────────────────

export interface ReadingYearDto {
  year: number;
  /** Years with at least one returned book, newest first (always includes the current year). */
  years: number[];
  books: number;
  previousYearBooks: number;
  pages: number;
  topCategory: { slug: string; nameTr: string; nameEn: string; count: number } | null;
  topAuthor: { name: string; count: number } | null;
  /** Returned books per month, January first. */
  perMonth: number[];
  /** Returned loans of the year, newest first. */
  loans: LoanDto[];
}

// ─── Notifications ───────────────────────────────────────────────────────────

export const NOTIFICATION_KINDS = ['reservationReady', 'dueReminder', 'overdue', 'newsletter'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
export type NotificationPrefs = Record<NotificationKind, { email: boolean; push: boolean }>;

/** Overdue notices can't be switched off; the newsletter is opt-in. */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  reservationReady: { email: true, push: true },
  dueReminder: { email: true, push: true },
  overdue: { email: true, push: true },
  newsletter: { email: false, push: false },
};

const channel = z.object({ email: z.boolean(), push: z.boolean() });
export const notificationPrefsSchema = z.object({
  reservationReady: channel,
  dueReminder: channel,
  overdue: channel,
  newsletter: channel,
});

export function withDefaultPrefs(stored: unknown): NotificationPrefs {
  const parsed = notificationPrefsSchema.partial().safeParse(stored);
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...(parsed.success ? parsed.data : {}) };
  return { ...prefs, overdue: { email: true, push: true } };
}
