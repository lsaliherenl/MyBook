import { Injectable, NotFoundException } from '@nestjs/common';
import type { EventDto, EventsQuery } from '@mybook/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EVENTS_BUCKET, SupabaseService } from '../supabase/supabase.service.js';

const eventInclude = {
  _count: { select: { registrations: { where: { waitlisted: false } } } },
} satisfies Prisma.EventInclude;

type EventWithCounts = Prisma.EventGetPayload<{ include: typeof eventInclude }>;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  async list({ when, kind, limit }: EventsQuery): Promise<EventDto[]> {
    const now = new Date();
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

  async detail(slug: string): Promise<EventDto> {
    const event = await this.prisma.event.findFirst({ where: { slug, isPublished: true }, include: eventInclude });
    if (!event) throw new NotFoundException('Event not found');
    const waitlists = await this.waitlistCounts([event.id]);
    return this.toDto(event, waitlists.get(event.id) ?? 0);
  }

  private async waitlistCounts(eventIds: string[]): Promise<Map<string, number>> {
    if (!eventIds.length) return new Map();
    const rows = await this.prisma.eventRegistration.groupBy({
      by: ['eventId'],
      where: { eventId: { in: eventIds }, waitlisted: true },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.eventId, r._count._all]));
  }

  private toDto(event: EventWithCounts, waitlisted: number): EventDto {
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
