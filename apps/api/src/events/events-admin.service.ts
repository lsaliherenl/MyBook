import { Injectable } from '@nestjs/common';
import {
  eventDetailsSchema,
  slugify,
  type AdminEventDto,
  type AdminEventList,
  type AdminEventListDto,
  type EventAttendeeDto,
  type SaveEventInput,
} from '@mybook/shared';
import { randomBytes } from 'node:crypto';
import type { AuthUser } from '../auth/auth.types.js';
import { Clock } from '../circulation/clock.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { eventInclude, EventException, EventsService } from './events.service.js';

/** The librarian's programme (B18): drafts, published and past events, editing and attendee lists. */
@Injectable()
export class EventsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly clock: Clock,
  ) {}

  private where(list: AdminEventList): Prisma.EventWhereInput {
    const now = this.clock.now();
    if (list === 'drafts') return { isPublished: false };
    // Published and not over yet; multi-day notices stay "upcoming" while they run.
    const live: Prisma.EventWhereInput = { OR: [{ startsAt: { gte: now } }, { endsAt: { gte: now } }] };
    return list === 'upcoming' ? { isPublished: true, ...live } : { isPublished: true, NOT: live };
  }

  async list(list: AdminEventList): Promise<AdminEventListDto> {
    const rows = await this.prisma.event.findMany({
      where: this.where(list),
      orderBy: { startsAt: list === 'past' ? 'desc' : 'asc' },
      include: eventInclude,
      take: 200,
    });
    const waitlists = await this.events.waitlistCounts(rows.map((e) => e.id));
    const counts = {
      upcoming: await this.prisma.event.count({ where: this.where('upcoming') }),
      drafts: await this.prisma.event.count({ where: this.where('drafts') }),
      past: await this.prisma.event.count({ where: this.where('past') }),
    };
    return { items: rows.map((e) => this.toAdmin(e, waitlists.get(e.id) ?? 0)), counts };
  }

  async get(eventId: string): Promise<AdminEventDto> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, include: eventInclude });
    if (!event) throw new EventException('event_not_found');
    const waitlists = await this.events.waitlistCounts([event.id]);
    return this.toAdmin(event, waitlists.get(event.id) ?? 0);
  }

  async create(actor: AuthUser, input: SaveEventInput): Promise<AdminEventDto> {
    const slug = await this.uniqueSlug(input.titleEn || input.titleTr, input.startsAt);
    const event = await this.prisma.event.create({ data: { ...this.fields(input), slug } });
    await this.audit(actor, 'event.create', event.id);
    return this.get(event.id);
  }

  /**
   * Saves changes. Adding seats lets waitlisted members in, in sign-up order; taking seats away
   * never drops anyone who already has one.
   */
  async update(actor: AuthUser, eventId: string, input: SaveEventInput): Promise<AdminEventDto> {
    await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM events WHERE id = ${eventId}::uuid FOR UPDATE`;
      if (!locked) throw new EventException('event_not_found');
      await tx.event.update({ where: { id: eventId }, data: this.fields(input) });
      const going = await tx.eventRegistration.count({ where: { eventId, waitlisted: false } });
      const free = input.capacity == null ? Infinity : input.capacity - going;
      if (free > 0) {
        const promote = await tx.eventRegistration.findMany({
          where: { eventId, waitlisted: true },
          orderBy: { createdAt: 'asc' },
          take: Number.isFinite(free) ? free : undefined,
          select: { memberId: true },
        });
        if (promote.length) {
          await tx.eventRegistration.updateMany({ where: { eventId, memberId: { in: promote.map((p) => p.memberId) } }, data: { waitlisted: false } });
        }
      }
    });
    await this.audit(actor, 'event.update', eventId);
    return this.get(eventId);
  }

  /** Deletes the event with its sign-ups (drafts, or an event that has to be called off). */
  async remove(actor: AuthUser, eventId: string): Promise<void> {
    const { count } = await this.prisma.event.deleteMany({ where: { id: eventId } });
    if (!count) throw new EventException('event_not_found');
    await this.audit(actor, 'event.delete', eventId);
  }

  async attendees(eventId: string): Promise<EventAttendeeDto[]> {
    if (!(await this.prisma.event.findUnique({ where: { id: eventId }, select: { id: true } }))) throw new EventException('event_not_found');
    const rows = await this.prisma.eventRegistration.findMany({
      where: { eventId },
      orderBy: [{ waitlisted: 'asc' }, { createdAt: 'asc' }],
      include: { member: { select: { id: true, fullName: true, email: true } } },
    });
    return rows.map((r) => ({ memberId: r.member.id, fullName: r.member.fullName, email: r.member.email, waitlisted: r.waitlisted, registeredAt: r.createdAt.toISOString() }));
  }

  async attendeesCsv(eventId: string): Promise<string> {
    const rows = await this.attendees(eventId);
    const escape = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [['name', 'email', 'status', 'registered_at'], ...rows.map((r) => [r.fullName, r.email, r.waitlisted ? 'waitlist' : 'going', r.registeredAt])];
    return '﻿' + lines.map((line) => line.map(escape).join(',')).join('\r\n') + '\r\n';
  }

  private fields(input: SaveEventInput) {
    return {
      kind: input.kind,
      titleTr: input.titleTr,
      titleEn: input.titleEn,
      descriptionTr: input.descriptionTr ?? null,
      descriptionEn: input.descriptionEn ?? null,
      locationTr: input.locationTr,
      locationEn: input.locationEn,
      startsAt: new Date(input.startsAt),
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      rsvpRequired: input.rsvpRequired,
      capacity: input.rsvpRequired ? (input.capacity ?? null) : null,
      isPublished: input.published,
    };
  }

  private toAdmin(event: Prisma.EventGetPayload<{ include: typeof eventInclude }>, waitlisted: number): AdminEventDto {
    const details = eventDetailsSchema.safeParse(event.details);
    return { ...this.events.toDto(event, waitlisted), published: event.isPublished, details: details.success ? details.data : {}, bookId: event.bookId };
  }

  private async uniqueSlug(title: string, startsAt: string): Promise<string> {
    const base = slugify(title) || 'event';
    for (const slug of [base, `${base}-${startsAt.slice(0, 10)}`, `${base}-${randomBytes(3).toString('hex')}`]) {
      if (!(await this.prisma.event.findUnique({ where: { slug }, select: { id: true } }))) return slug;
    }
    return `${base}-${randomBytes(4).toString('hex')}`;
  }

  private audit(actor: AuthUser, action: string, eventId: string) {
    return this.prisma.auditLog.create({ data: { actorId: actor.id, action, entityType: 'event', entityId: eventId } });
  }
}
