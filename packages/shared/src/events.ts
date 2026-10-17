import { z } from 'zod';
import type { BookSummaryDto } from './catalog.js';

export const EVENT_KINDS = ['BOOK_CLUB', 'WORKSHOP', 'TALK', 'NOTICE'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const eventsQuerySchema = z.object({
  when: z.enum(['upcoming', 'past']).default('upcoming'),
  kind: z.enum(EVENT_KINDS).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type EventsQuery = z.infer<typeof eventsQuerySchema>;

export interface EventDto {
  id: string;
  slug: string;
  kind: EventKind;
  titleTr: string;
  titleEn: string;
  descriptionTr: string | null;
  descriptionEn: string | null;
  locationTr: string;
  locationEn: string;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  /** Null means open seating. */
  capacity: number | null;
  rsvpRequired: boolean;
  /** Confirmed sign-ups; waitlisted members are counted separately. */
  registered: number;
  waitlisted: number;
}

/** A text in both site languages. */
export interface Bilingual {
  tr: string;
  en: string;
}

const bilingual = z.object({ tr: z.string().trim().max(2000), en: z.string().trim().max(2000) });

/** The richer part of an event page; every field is optional. */
export const eventDetailsSchema = z.object({
  audience: bilingual.optional(),
  host: z.object({ name: bilingual, note: bilingual.optional() }).optional(),
  directions: bilingual.optional(),
  programme: z.array(z.object({ time: z.string().regex(/^\d{2}:\d{2}$/), title: bilingual, note: bilingual.optional() })).max(20).optional(),
});
export type EventDetails = z.infer<typeof eventDetailsSchema>;

export interface EventDetailDto extends EventDto {
  details: EventDetails;
  /** The book to bring, with its current availability. */
  book: BookSummaryDto | null;
}

export type RsvpStatus = 'none' | 'going' | 'waitlisted';

export interface MyRsvpDto {
  status: RsvpStatus;
  /** 1 = next in line, for waitlisted members. */
  waitlistPosition: number | null;
  remind: boolean;
}

export const EVENT_ERRORS = ['event_not_found', 'event_no_rsvp', 'event_started'] as const;
export type EventError = (typeof EVENT_ERRORS)[number];
