/** Event management against PGlite with every migration applied. */
import type { SaveEventInput } from '@mybook/shared';
import { createMember, createTestDb, type TestDb } from '../../test/support/test-db.js';
import type { AuthUser } from '../auth/auth.types.js';
import { Clock } from '../circulation/clock.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { EventsAdminService } from './events-admin.service.js';
import { EventsService } from './events.service.js';

class FakeClock extends Clock {
  current = new Date('2026-11-01T09:00:00Z');
  override now() {
    return new Date(this.current);
  }
}

const supabase = { publicUrl: (_bucket: string, path: string) => `https://storage.test/${path}` } as unknown as SupabaseService;

let db: TestDb;
let events: EventsService;
let admin: EventsAdminService;
let librarian: AuthUser;

const asUser = (p: { id: string; email: string; role: AuthUser['role']; status: AuthUser['status'] }): AuthUser => ({ id: p.id, email: p.email, role: p.role, status: p.status });

const input = (overrides: Partial<SaveEventInput> = {}): SaveEventInput => ({
  kind: 'BOOK_CLUB',
  titleTr: 'Okuma Halkası: Huzur',
  titleEn: 'Reading Circle: Huzur',
  locationTr: 'Okuma Salonu, 2. kat',
  locationEn: 'Reading Room, 2nd floor',
  startsAt: '2026-11-12T16:00:00Z',
  endsAt: '2026-11-12T18:00:00Z',
  rsvpRequired: true,
  capacity: 1,
  published: true,
  ...overrides,
});

beforeEach(async () => {
  db = await createTestDb();
  const clock = new FakeClock();
  const prisma = db.prisma as unknown as PrismaService;
  events = new EventsService(prisma, supabase, clock);
  admin = new EventsAdminService(prisma, events, clock);
  librarian = asUser(await createMember(db, { role: 'LIBRARIAN', name: 'Mehmet Demir' }));
});

afterEach(() => db.close());

describe('event management', () => {
  it('creates drafts and published events, sorted into upcoming, drafts and past', async () => {
    const draft = await admin.create(librarian, input({ published: false }));
    const live = await admin.create(librarian, input());
    await admin.create(librarian, input({ startsAt: '2026-10-01T16:00:00Z', endsAt: '2026-10-01T18:00:00Z' }));

    expect(draft.slug).toBe('reading-circle-huzur');
    expect(live.slug).toBe('reading-circle-huzur-2026-11-12');
    const upcoming = await admin.list('upcoming');
    expect(upcoming.counts).toEqual({ upcoming: 1, drafts: 1, past: 1 });
    expect(upcoming.items.map((e) => e.id)).toEqual([live.id]);
    // Members never see drafts.
    expect((await events.list({ when: 'upcoming', limit: 50 })).map((e) => e.id)).toEqual([live.id]);
  });

  it('adding seats lets the waitlist in; the attendee list shows who is going', async () => {
    const event = await admin.create(librarian, input());
    const [a, b] = [await createMember(db, { name: 'Ayşe Yılmaz' }), await createMember(db, { name: 'Can Öztürk' })];
    await events.rsvp(a.id, event.slug);
    expect((await events.rsvp(b.id, event.slug)).status).toBe('waitlisted');

    const saved = await admin.update(librarian, event.id, input({ capacity: 2 }));
    expect(saved).toMatchObject({ registered: 2, waitlisted: 0 });
    expect((await admin.attendees(event.id)).map((x) => [x.fullName, x.waitlisted])).toEqual([
      ['Ayşe Yılmaz', false],
      ['Can Öztürk', false],
    ]);
    expect(await admin.attendeesCsv(event.id)).toContain('Can Öztürk');

    await admin.remove(librarian, event.id);
    await expect(admin.get(event.id)).rejects.toMatchObject({ code: 'event_not_found' });
  });
});
