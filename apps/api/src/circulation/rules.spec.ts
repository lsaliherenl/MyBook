import { describe, expect, it } from 'vitest';
import { dueDate, pickupDeadline } from './rules.js';

// Istanbul is UTC+3; 2026-10-15 is a Thursday.
const at = (local: string) => new Date(`${local}+03:00`);

describe('pickupDeadline', () => {
  it('gives the full window when no Sunday falls inside it', () => {
    expect(pickupDeadline(at('2026-10-13T10:00:00'), 48)).toEqual(at('2026-10-15T10:00:00'));
  });

  it('does not count a Sunday inside the window', () => {
    // Fri 14:20 + 48 h would be Sun 14:20; with Sunday skipped it is Mon 14:20.
    expect(pickupDeadline(at('2026-10-16T14:20:00'), 48)).toEqual(at('2026-10-19T14:20:00'));
  });

  it('skips the Sunday a hold starts on', () => {
    expect(pickupDeadline(at('2026-10-18T11:00:00'), 48)).toEqual(at('2026-10-21T11:00:00'));
  });

  it('keeps extending while the longer window reaches another Sunday', () => {
    // Fri 16th + 8 days lands on Sat 24th; skipping Sun 18th moves it onto Sun 25th, which is skipped too.
    expect(pickupDeadline(at('2026-10-16T12:00:00'), 8 * 24)).toEqual(at('2026-10-26T12:00:00'));
  });
});

describe('dueDate', () => {
  it('keeps a due date that lands on an open day', () => {
    // Thu + 14 days is a Thursday.
    expect(dueDate(at('2026-10-15T16:45:00'), 14)).toEqual(at('2026-10-29T16:45:00'));
  });

  it('moves a due date off a Sunday to Monday at the same time', () => {
    // Sun 18th + 14 days is Sun 1 Nov, when the library is closed.
    expect(dueDate(at('2026-10-18T10:30:00'), 14)).toEqual(at('2026-11-02T10:30:00'));
    // A loan period that is not whole weeks: Thu 22nd + 10 days is Sun 1 Nov too.
    expect(dueDate(at('2026-10-22T10:30:00'), 10)).toEqual(at('2026-11-02T10:30:00'));
  });

  it('decides Sunday by library time, not UTC', () => {
    // Sun 1 Nov 00:30 in Istanbul is still Saturday in UTC.
    expect(dueDate(at('2026-10-18T00:30:00'), 14)).toEqual(at('2026-11-02T00:30:00'));
    // Sat 31 Oct 23:30 in Istanbul stays a Saturday.
    expect(dueDate(at('2026-10-17T23:30:00'), 14)).toEqual(at('2026-10-31T23:30:00'));
  });
});
