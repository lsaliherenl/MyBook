import { z } from 'zod';

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
