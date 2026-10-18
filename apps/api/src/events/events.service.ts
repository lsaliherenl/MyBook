import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { eventDetailsSchema, type EventDetailDto, type EventDto, type EventError, type EventsQuery, type MyRsvpDto } from '@mybook/shared';
import { bookInclude, toBookSummary } from '../catalog/book.mapper.js';
import { Clock } from '../circulation/clock.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EVENTS_BUCKET, SupabaseService } from '../supabase/supabase.service.js';

export const eventInclude = {
  _count: { select: { registrations: { where: { waitlisted: false } } } },
} satisfies Prisma.EventInclude;

type EventWithCounts = Prisma.EventGetPayload<{ include: typeof eventInclude }>;
type Tx = Prisma.TransactionClient;

/** A refused event action; the body carries a stable `code` like circulation refusals do. */
export class EventException extends HttpException {
  constructor(readonly code: EventError) {
    const status = code === 'event_not_found' ? HttpStatus.NOT_FOUND : HttpStatus.CONFLICT;
    super({ statusCode: status, error: 'Event', code, message: code }, status);
  }
}

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly clock: Clock,
  ) {}

  async list({ when, kind, limit }: EventsQuery): Promise<EventDto[]> {
    const now = this.clock.now();
    // An event stays "upcoming" until it has ended, so multi-day notices remain listed while they run.
    const upcoming: Prisma.EventWhereInput = { OR: [{ startsAt: { gte: now } }, { endsAt: { gte: now } }] };
    const past: Prisma.EventWhereInput = { startsAt: { lt: now }, OR: [{ endsAt: null }, { endsAt: { lt: now } }] };
    const events = await this.prisma.event.findMany({
      where: { isPublished: true, ...(kind && { kind }), ...(when === 'upcoming' ? upcoming : past) },
      orderBy: { startsAt: when === 'upcoming' ? 'asc' : 'desc' },
      take: limit,
      include: eventInclude,
    });
    const waitlists = await this.waitlistCounts(events.map((e) => e.id));
    return events.map((e) => this.toDto(e, waitlists.get(e.id) ?? 0));
  }

  async detail(slug: string): Promise<EventDetailDto> {
    const event = await this.prisma.event.findFirst({
      where: { slug, isPublished: true },
      include: { ...eventInclude, book: { include: bookInclude } },
    });
    if (!event) throw new EventException('event_not_found');
    const waitlists = await this.waitlistCounts([event.id]);
    const details = eventDetailsSchema.safeParse(event.details);
    return {
      ...this.toDto(event, waitlists.get(event.id) ?? 0),
      details: details.success ? details.data : {},
      book: event.book ? toBookSummary(event.book, this.supabase) : null,
    };
  }

  async myRsvp(memberId: string, slug: string): Promise<MyRsvpDto> {
    const event = await this.findPublished(this.prisma, slug);
    return this.rsvpOf(this.prisma, event.id, memberId);
  }

  /** Takes a seat, or a waitlist place when the event is full. Asking twice changes nothing. */
  async rsvp(memberId: string, slug: string): Promise<MyRsvpDto> {
    return this.prisma.$transaction(async (tx) => {
      const event = await this.lockOpenEvent(tx, slug);
      const existing = await tx.eventRegistration.findUnique({ where: { eventId_memberId: { eventId: event.id, memberId } } });
      if (!existing) {
        const going = await tx.eventRegistration.count({ where: { eventId: event.id, waitlisted: false } });
        const full = event.capacity !== null && going >= event.capacity;
        await tx.eventRegistration.create({ data: { eventId: event.id, memberId, waitlisted: full } });
      }
      return this.rsvpOf(tx, event.id, memberId);
    });
  }

  /** Gives the seat back; the first person on the waitlist takes it. */
  async cancel(memberId: string, slug: string): Promise<MyRsvpDto> {
    return this.prisma.$transaction(async (tx) => {
      const event = await this.lockOpenEvent(tx, slug);
      const existing = await tx.eventRegistration.findUnique({ where: { eventId_memberId: { eventId: event.id, memberId } } });
      if (existing) {
        await tx.eventRegistration.delete({ where: { eventId_memberId: { eventId: event.id, memberId } } });
        if (!existing.waitlisted) {
          const next = await tx.eventRegistration.findFirst({ where: { eventId: event.id, waitlisted: true }, orderBy: { createdAt: 'asc' } });
          if (next) await tx.eventRegistration.update({ where: { eventId_memberId: { eventId: event.id, memberId: next.memberId } }, data: { waitlisted: false } });
        }
      }
      return this.rsvpOf(tx, event.id, memberId);
    });
  }

  async setReminder(memberId: string, slug: string, remind: boolean): Promise<MyRsvpDto> {
    const event = await this.findPublished(this.prisma, slug);
    await this.prisma.eventRegistration.updateMany({ where: { eventId: event.id, memberId }, data: { remind } });
    return this.rsvpOf(this.prisma, event.id, memberId);
  }

  private async findPublished(db: Tx | PrismaService, slug: string) {
    const event = await db.event.findFirst({ where: { slug, isPublished: true }, select: { id: true, capacity: true, rsvpRequired: true, startsAt: true } });
    if (!event) throw new EventException('event_not_found');
    return event;
  }

  /** Locks the event row so two last-seat sign-ups cannot both get in. */
  private async lockOpenEvent(tx: Tx, slug: string) {
    const event = await this.findPublished(tx, slug);
    await tx.$queryRaw`SELECT id FROM events WHERE id = ${event.id}::uuid FOR UPDATE`;
    if (!event.rsvpRequired) throw new EventException('event_no_rsvp');
    if (event.startsAt <= this.clock.now()) throw new EventException('event_started');
    return event;
  }

  private async rsvpOf(db: Tx | PrismaService, eventId: string, memberId: string): Promise<MyRsvpDto> {
    const mine = await db.eventRegistration.findUnique({ where: { eventId_memberId: { eventId, memberId } } });
    if (!mine) return { status: 'none', waitlistPosition: null, remind: true };
    if (!mine.waitlisted) return { status: 'going', waitlistPosition: null, remind: mine.remind };
    const ahead = await db.eventRegistration.count({ where: { eventId, waitlisted: true, createdAt: { lt: mine.createdAt } } });
    return { status: 'waitlisted', waitlistPosition: ahead + 1, remind: mine.remind };
  }

  async waitlistCounts(eventIds: string[]): Promise<Map<string, number>> {
    if (!eventIds.length) return new Map();
    const rows = await this.prisma.eventRegistration.groupBy({
      by: ['eventId'],
      where: { eventId: { in: eventIds }, waitlisted: true },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.eventId, r._count._all]));
  }

  toDto(event: EventWithCounts, waitlisted: number): EventDto {
    return {
      id: event.id,
      slug: event.slug,
      kind: event.kind,
      titleTr: event.titleTr,
      titleEn: event.titleEn,
      descriptionTr: event.descriptionTr,
      descriptionEn: event.descriptionEn,
      locationTr: event.locationTr,
      locationEn: event.locationEn,
      imageUrl: event.imagePath ? this.supabase.publicUrl(EVENTS_BUCKET, event.imagePath) : null,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt?.toISOString() ?? null,
      capacity: event.capacity,
      rsvpRequired: event.rsvpRequired,
      registered: event._count.registrations,
      waitlisted,
    };
  }
}
