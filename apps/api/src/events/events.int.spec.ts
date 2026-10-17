/** Event sign-ups against PGlite with every migration applied. */
import { createMember, createTestDb, type TestDb } from '../../test/support/test-db.js';
import { Clock } from '../circulation/clock.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { EventsService } from './events.service.js';

class FakeClock extends Clock {
  current = new Date('2026-11-01T09:00:00Z');
  override now() {
    return new Date(this.current);
  }
}

const supabase = { publicUrl: (_bucket: string, path: string) => `https://storage.test/${path}` } as unknown as SupabaseService;

let db: TestDb;
let clock: FakeClock;
let events: EventsService;

beforeEach(async () => {
  db = await createTestDb();
  clock = new FakeClock();
  events = new EventsService(db.prisma as unknown as PrismaService, supabase, clock);
});

afterEach(() => db.close());

async function createEvent(overrides: { capacity?: number | null; rsvpRequired?: boolean } = {}) {
  return db.prisma.event.create({
    data: {
      slug: 'reading-circle',
      kind: 'BOOK_CLUB',
      titleTr: 'Okuma Halkası',
      titleEn: 'Reading Circle',
      locationTr: 'Okuma Salonu',
      locationEn: 'Reading Room',
      startsAt: new Date('2026-11-12T16:00:00Z'),
      capacity: overrides.capacity === undefined ? 2 : overrides.capacity,
      rsvpRequired: overrides.rsvpRequired ?? true,
      isPublished: true,
    },
  });
}

describe('event sign-ups', () => {
  it('fills the seats, then queues, and moves the first in line up when someone cancels', async () => {
    await createEvent({ capacity: 2 });
    const [a, b, c, d] = [await createMember(db), await createMember(db), await createMember(db), await createMember(db)];

    expect((await events.rsvp(a.id, 'reading-circle')).status).toBe('going');
    expect((await events.rsvp(b.id, 'reading-circle')).status).toBe('going');
    expect(await events.rsvp(c.id, 'reading-circle')).toMatchObject({ status: 'waitlisted', waitlistPosition: 1 });
    expect(await events.rsvp(d.id, 'reading-circle')).toMatchObject({ status: 'waitlisted', waitlistPosition: 2 });
    expect(await events.rsvp(a.id, 'reading-circle')).toMatchObject({ status: 'going' }); // asking twice changes nothing

    await events.cancel(a.id, 'reading-circle');

    expect((await events.myRsvp(c.id, 'reading-circle')).status).toBe('going');
    expect(await events.myRsvp(d.id, 'reading-circle')).toMatchObject({ status: 'waitlisted', waitlistPosition: 1 });
    const detail = await events.detail('reading-circle');
    expect(detail).toMatchObject({ registered: 2, waitlisted: 1 });
  });

  it('never waitlists open-seating events and refuses notices and past events', async () => {
    await createEvent({ capacity: null });
    const member = await createMember(db);
    expect((await events.rsvp(member.id, 'reading-circle')).status).toBe('going');

    await db.prisma.event.update({ where: { slug: 'reading-circle' }, data: { rsvpRequired: false } });
    await expect(events.rsvp(member.id, 'reading-circle')).rejects.toMatchObject({ code: 'event_no_rsvp' });

    await db.prisma.event.update({ where: { slug: 'reading-circle' }, data: { rsvpRequired: true } });
    clock.current = new Date('2026-11-12T16:30:00Z');
    await expect(events.cancel(member.id, 'reading-circle')).rejects.toMatchObject({ code: 'event_started' });
    await expect(events.rsvp(member.id, 'nope')).rejects.toMatchObject({ code: 'event_not_found' });
  });
});
