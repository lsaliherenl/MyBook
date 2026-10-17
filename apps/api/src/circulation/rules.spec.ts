import { describe, expect, it } from 'vitest';
import { pickupDeadline } from './rules.js';

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
